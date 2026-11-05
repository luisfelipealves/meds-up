import { API_VERSION, ROLES, SCHEMA_VERSION, validateUntrustedPrescriptionProposal } from "@medsup/contracts";
import { Worker } from "node:worker_threads";
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
const WORKER_ABORTED = Symbol("worker-aborted");

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

function requireExtractor(extractor) {
  if (!(extractor?.moduleUrl instanceof URL) || extractor.moduleUrl.protocol !== "file:") {
    throw new TypeError("A local provider-neutral extraction module is required");
  }
  for (const callback of ["recordRawResponse", "recordLifecycle"]) {
    if (extractor[callback] !== undefined && typeof extractor[callback] !== "function") {
      throw new TypeError(`Extractor ${callback} must be a function`);
    }
  }
  return Object.freeze({
    moduleUrl: extractor.moduleUrl.href,
    extractorData: extractor.extractorData,
    recordRawResponse: extractor.recordRawResponse,
    recordLifecycle: extractor.recordLifecycle,
  });
}

function startExtractorWorker(extractor, request) {
  const worker = new Worker(new URL("./ocr-extractor-worker.mjs", import.meta.url), {
    workerData: Object.freeze({
      moduleUrl: extractor.moduleUrl,
      extractorData: extractor.extractorData,
      request,
    }),
  });
  let exited = false;
  let resolveExit;
  let resolveResult;
  const exitPromise = new Promise((resolve) => { resolveExit = resolve; });
  const resultPromise = new Promise((resolve) => { resolveResult = resolve; });
  worker.on("message", (message) => {
    if (message?.type === "COMPLETED" || message?.type === "FAILED") resolveResult(message);
  });
  worker.once("error", () => resolveResult(Object.freeze({ type: "FAILED" })));
  worker.once("exit", () => {
    exited = true;
    resolveResult(Object.freeze({ type: "FAILED" }));
    resolveExit();
  });
  return Object.freeze({
    abort() {
      if (!exited) worker.postMessage(Object.freeze({ type: "ABORT" }));
    },
    resultPromise,
    async terminate() {
      if (!exited) await worker.terminate();
      await exitPromise;
    },
  });
}

export function createOcrProposalAdapter({ extractor, providerControls, terminationGraceMs = 100 } = {}) {
  const configuredExtractor = requireExtractor(extractor);
  if (
    !hasExactKeys(providerControls, ["retentionDisabled", "trainingDisabled"])
    || providerControls.retentionDisabled !== true
    || providerControls.trainingDisabled !== true
  ) {
    throw new TypeError("Retention and training must both be explicitly disabled");
  }
  if (!Number.isSafeInteger(terminationGraceMs) || terminationGraceMs <= 0) {
    throw new TypeError("terminationGraceMs must be a positive safe integer");
  }

  return Object.freeze({
    async extract(request, { signal } = {}) {
      if (!(signal instanceof AbortSignal)) throw new TypeError("A bounded extraction AbortSignal is required");
      const extractorWorker = startExtractorWorker(configuredExtractor, request);
      let raw;
      let abortHandler;
      const abortedPromise = new Promise((resolve) => {
        abortHandler = () => resolve(WORKER_ABORTED);
        if (signal.aborted) abortHandler();
        else signal.addEventListener("abort", abortHandler, { once: true });
      });
      let lifecycleOutcome = "FAILED";
      try {
        const outcome = await Promise.race([extractorWorker.resultPromise, abortedPromise]);
        if (outcome === WORKER_ABORTED) {
          lifecycleOutcome = "ABORTED";
          extractorWorker.abort();
          await Promise.race([
            extractorWorker.resultPromise,
            new Promise((resolve) => setTimeout(resolve, terminationGraceMs)),
          ]);
          throw error(OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED);
        }
        if (outcome.type !== "COMPLETED") throw error(OCR_PROPOSAL_ERROR_CODES.EXTRACTION_FAILED);
        raw = outcome.rawResponse;
        configuredExtractor.recordRawResponse?.(raw);
        const structured = structuredClone(parseRawExtraction(raw));
        lifecycleOutcome = "COMPLETED";
        return structured;
      } catch (cause) {
        if (cause instanceof OcrProposalError) throw cause;
        throw error(OCR_PROPOSAL_ERROR_CODES.EXTRACTION_FAILED);
      } finally {
        signal.removeEventListener("abort", abortHandler);
        await extractorWorker.terminate();
        if (raw instanceof Uint8Array) raw.fill(0);
        configuredExtractor.recordLifecycle?.(Object.freeze({ outcome: lifecycleOutcome, discarded: true }));
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
  let activeAbortController = null;
  let expiryTimer = null;

  function requireOwner(candidate) {
    try {
      const doctor = requireRole(candidate, ROLES.DOCTOR);
      if (doctor.subjectId !== owner.subjectId) throw new Error("owner mismatch");
      authorizeReviewSession(doctor, reviewSessionId);
    } catch {
      throw error(OCR_PROPOSAL_ERROR_CODES.NOT_FOUND);
    }
  }

  function expire() {
    if (ended) return;
    proposal = null;
    ended = true;
    logger.log("ocr.proposal.discarded", { action: "DISCARD_PROPOSAL", outcome: "TIMED_OUT", failureCategory: "SESSION_ENDED" });
    activeAbortController?.abort();
  }

  function assertActive() {
    if (!ended && clock() >= expiresAt) expire();
    if (ended) throw error(OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED);
  }

  function end(candidate) {
    requireOwner(candidate);
    if (ended) throw error(OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED);
    proposal = null;
    ended = true;
    if (expiryTimer !== null) clearTimeout(expiryTimer);
    logger.log("ocr.proposal.discarded", { action: "DISCARD_PROPOSAL", outcome: "COMPLETED" });
    activeAbortController?.abort();
  }

  return Object.freeze({
    async extract(candidate, request) {
      requireOwner(candidate);
      assertActive();
      if (inProgress) throw error(OCR_PROPOSAL_ERROR_CODES.OPERATION_IN_PROGRESS);
      inProgress = true;
      activeAbortController = new AbortController();
      expiryTimer = setTimeout(expire, Math.max(0, expiresAt - clock()));
      try {
        const extracted = await adapter.extract(
          Object.freeze({ ...request, reviewSessionId }),
          Object.freeze({ signal: activeAbortController.signal }),
        );
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
        const sessionEnded = ended || cause?.code === OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED;
        logger.log("ocr.proposal.failed", {
          action: "EXTRACT_PROPOSAL",
          outcome: sessionEnded ? "TIMED_OUT" : "FAILED",
          failureCategory: sessionEnded
            ? OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED
            : (cause instanceof OcrProposalError ? cause.code : OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE),
        });
        if (sessionEnded) throw error(OCR_PROPOSAL_ERROR_CODES.SESSION_ENDED);
        if (cause instanceof OcrProposalError) throw cause;
        throw error(OCR_PROPOSAL_ERROR_CODES.INVALID_RESPONSE);
      } finally {
        if (expiryTimer !== null) clearTimeout(expiryTimer);
        expiryTimer = null;
        activeAbortController = null;
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
