import { API_VERSION, ROLES, SCHEMA_VERSION, validateUntrustedPrescriptionProposal } from "@medsup/contracts";
import { createRoleGuard } from "../identity/subject.mjs";

export const OCR_PROPOSAL_ERROR_CODES = Object.freeze({
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  SESSION_ENDED: "SESSION_ENDED",
  NOT_FOUND: "NOT_FOUND",
  OPERATION_IN_PROGRESS: "OPERATION_IN_PROGRESS",
});

const MAX_RAW_RESPONSE_BYTES = 256 * 1024;
const EXACT_EXTRACTION_FIELDS = Object.freeze(["clinicalContent", "confidence", "provenance"]);

class OcrProposalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OcrProposalError";
    this.code = code;
  }
}

function error(code) {
  const messages = {
    [OCR_PROPOSAL_ERROR_CODES.EXTRACTION_FAILED]: "The extraction could not be completed.",
    [OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE]: "The extraction response was rejected.",
    [OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED]: "The review session is no longer active.",
    [OCR_PROPOSAL_ERROR_CODES.NOT_FOUND]: "The resource was not found.",
    [OCR_PROPOSAL_ERROR_CODES.OPERATION_IN_PROGRESS]: "An extraction is already in progress.",
  };
  return new OcrProposalError(code, messages[code]);
}

function hasExactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && Object.keys(value).every((key) => keys.includes(key));
}

function parseRawExtraction(raw) {
  if (!(raw instanceof Uint8Array) || raw.byteLength === 0 || raw.byteLength > MAX_RAW_RESPONSE_BYTES) {
    throw error(OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE);
  }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
  } catch {
    throw error(OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE);
  }
  if (!hasExactKeys(parsed, EXACT_EXTRACTION_FIELDS)) {
    throw error(OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE);
  }
  return parsed;
}

export function createOcrProposalAdapter({ extractor, providerControls } = {}) {
  if (typeof extractor?.extract !== "function") {
    throw new TypeError("A provider-neutral extraction port is required");
  }
  if (
    !hasExactKeys(providerControls, ["retentionDisabled", "trainingDisabled"])
    || providerControls.retentionDisabled !== true
    || providerControls.trainingDisabled !== true
  ) {
    throw new TypeError("Retention and training must both be explicitly disabled");
  }

  return Object.freeze({
    async extract(request) {
      let raw;
      try {
        raw = await extractor.extract(request);
        return structuredClone(parseRawExtraction(raw));
      } catch (cause) {
        if (cause instanceof OcrProposalError) throw cause;
        throw error(OCR_PROPOSAL_ERROR_CODES.EXTRACTION_FAILED);
      } finally {
        if (raw instanceof Uint8Array) raw.fill(0);
      }
    },
  });
}

export function createOcrProposalReviewSession({
  subject,
  reviewSessionId,
  expiresAt,
  assertAuthenticatedSubject,
  authorizeReviewSession,
  adapter,
  clock = Date.now,
  logger = Object.freeze({ log() {} }),
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  if (typeof authorizeReviewSession !== "function") throw new TypeError("An active review-session authorizer is required");
  if (typeof adapter?.extract !== "function") throw new TypeError("An OCR proposal adapter is required");
  if (typeof clock !== "function") throw new TypeError("A clock is required");
  if (typeof logger?.log !== "function") throw new TypeError("A structured logger is required");
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= clock()) throw new TypeError("A future session expiry is required");

  let owner;
  try {
    owner = requireRole(subject, ROLES.DOCTOR);
    authorizeReviewSession(owner, reviewSessionId);
  } catch {
    throw error(OCR_PROPOSAL_ERROR_CODES.NOT_FOUND);
  }

  let proposal = null;
  let ended = false;
  let inProgress = false;

  function requireOwner(candidate) {
    try {
      const doctor = requireRole(candidate, ROLES.DOCTOR);
      if (doctor.subjectId !== owner.subjectId) throw new Error("owner mismatch");
      authorizeReviewSession(doctor, reviewSessionId);
    } catch {
      throw error(OCR_PROPOSAL_ERROR_CODES.NOT_FOUND);
    }
  }

  function assertActive() {
    if (!ended && clock() >= expiresAt) {
      proposal = null;
      ended = true;
      logger.log("ocr.proposal.discarded", { action: "DISCARD_PROPOSAL", outcome: "TIMED_OUT", failureCategory: "SESSION_ENDED" });
    }
    if (ended) throw error(OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED);
  }

  function end(candidate) {
    requireOwner(candidate);
    proposal = null;
    ended = true;
    logger.log("ocr.proposal.discarded", { action: "DISCARD_PROPOSAL", outcome: "COMPLETED" });
  }

  return Object.freeze({
    async extract(candidate, request) {
      requireOwner(candidate);
      assertActive();
      if (inProgress) throw error(OCR_PROPOSAL_ERROR_CODES.OPERATION_IN_PROGRESS);
      inProgress = true;
      try {
        const extracted = await adapter.extract(Object.freeze({ ...request, reviewSessionId }));
        assertActive();
        const generatedAt = new Date(clock()).toISOString();
        proposal = validateUntrustedPrescriptionProposal({
          apiVersion: API_VERSION,
          schemaVersion: SCHEMA_VERSION,
          lifecycle: "SESSION_ONLY_UNTRUSTED",
          reviewSessionId,
          generatedAt,
          expiresAt: new Date(expiresAt).toISOString(),
          provenance: extracted.provenance,
          confidence: extracted.confidence,
          clinicalContent: extracted.clinicalContent,
        });
        logger.log("ocr.proposal.completed", { action: "EXTRACT_PROPOSAL", outcome: "COMPLETED" });
        return structuredClone(proposal);
      } catch (cause) {
        proposal = null;
        logger.log("ocr.proposal.failed", {
          action: "EXTRACT_PROPOSAL",
          outcome: cause?.code === OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED ? "TIMED_OUT" : "FAILED",
          failureCategory: cause instanceof OcrProposalError ? cause.code : OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE,
        });
        if (cause instanceof OcrProposalError) throw cause;
        throw error(OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE);
      } finally {
        inProgress = false;
      }
    },
    getProposal(candidate) {
      requireOwner(candidate);
      assertActive();
      return proposal === null ? null : structuredClone(proposal);
    },
    abandon: end,
    complete: end,
    reload: end,
  });
}
