import { ROLES } from "@medsup/contracts";
import { createRoleGuard } from "../identity/subject.mjs";

export const DOCUMENT_ERROR_CODES = Object.freeze({
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  INVALID_DOCUMENT: "INVALID_DOCUMENT",
  DOCUMENT_LIMIT_EXCEEDED: "DOCUMENT_LIMIT_EXCEEDED",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  PROCESSING_TIMEOUT: "PROCESSING_TIMEOUT",
});

export const DEFAULT_DOCUMENT_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxPdfPages: 20,
  maxImagePixels: 20_000_000,
});

const MEDIA_TYPES = Object.freeze({
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
});
const PDF_HEADER = "%PDF-";
const PDF_END = "%%EOF";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_END = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

class DocumentGatewayError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DocumentGatewayError";
    this.code = code;
  }
}

function rejected(code = DOCUMENT_ERROR_CODES.INVALID_DOCUMENT) {
  return new DocumentGatewayError(code, "The source document was rejected.");
}

function failed() {
  return new DocumentGatewayError(
    DOCUMENT_ERROR_CODES.PROCESSING_FAILED,
    "The source document could not be processed.",
  );
}

function timedOut() {
  return new DocumentGatewayError(
    DOCUMENT_ERROR_CODES.PROCESSING_TIMEOUT,
    "The source document processing time expired.",
  );
}

function matchesAt(input, expected, offset = 0) {
  return expected.every((value, index) => input[offset + index] === value);
}

function readUint32(input, offset) {
  return (
    (input[offset] * 0x1000000)
    + (input[offset + 1] << 16)
    + (input[offset + 2] << 8)
    + input[offset + 3]
  );
}

function assertImageLimit(width, height, maxImagePixels) {
  if (
    !Number.isSafeInteger(width)
    || !Number.isSafeInteger(height)
    || width <= 0
    || height <= 0
    || width > maxImagePixels
    || height > maxImagePixels
    || width * height > maxImagePixels
  ) {
    throw rejected(DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED);
  }
}

function validatePng(input, limits) {
  if (
    input.byteLength < 45
    || !matchesAt(input, PNG_SIGNATURE)
    || !matchesAt(input, [0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52], 8)
    || !matchesAt(input, PNG_END, input.byteLength - PNG_END.length)
  ) {
    throw rejected();
  }
  assertImageLimit(readUint32(input, 16), readUint32(input, 20), limits.maxImagePixels);
}

function validateJpeg(input, limits) {
  if (
    input.byteLength < 4
    || input[0] !== 0xff
    || input[1] !== 0xd8
    || input[input.byteLength - 2] !== 0xff
    || input[input.byteLength - 1] !== 0xd9
  ) {
    throw rejected();
  }

  let offset = 2;
  while (offset < input.byteLength - 2) {
    if (input[offset] !== 0xff) throw rejected();
    const marker = input[offset + 1];
    if (marker === 0xda) break;
    if (marker === 0xd9 || marker === 0x00 || marker === 0xff) throw rejected();
    if (offset + 3 >= input.byteLength) throw rejected();
    const segmentLength = (input[offset + 2] << 8) + input[offset + 3];
    if (segmentLength < 2 || offset + 2 + segmentLength > input.byteLength) throw rejected();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (segmentLength < 7) throw rejected();
      const height = (input[offset + 5] << 8) + input[offset + 6];
      const width = (input[offset + 7] << 8) + input[offset + 8];
      assertImageLimit(width, height, limits.maxImagePixels);
      return;
    }
    offset += 2 + segmentLength;
  }
  throw rejected();
}

function validatePdf(input, limits) {
  const text = new TextDecoder("latin1", { fatal: true }).decode(input);
  if (
    !text.startsWith(PDF_HEADER)
    || !text.trimEnd().endsWith(PDF_END)
    || /<\/?script\b|\/JavaScript\b|\/JS\b/i.test(text)
  ) {
    throw rejected();
  }
  const pageCount = text.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  if (pageCount === 0) throw rejected();
  if (pageCount > limits.maxPdfPages) {
    throw rejected(DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED);
  }
}

function validateDocument(input, declaredMimeType, limits) {
  if (!(input instanceof Uint8Array) || input.byteLength === 0) throw rejected();
  if (!Object.hasOwn(MEDIA_TYPES, declaredMimeType)) {
    throw rejected(DOCUMENT_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE);
  }
  if (input.byteLength > limits.maxBytes) {
    throw rejected(DOCUMENT_ERROR_CODES.DOCUMENT_LIMIT_EXCEEDED);
  }
  if (declaredMimeType === "application/pdf") validatePdf(input, limits);
  if (declaredMimeType === "image/jpeg") validateJpeg(input, limits);
  if (declaredMimeType === "image/png") validatePng(input, limits);
}

function validateLimits(limits) {
  for (const key of ["maxBytes", "maxPdfPages", "maxImagePixels"]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] <= 0) {
      throw new TypeError(`Document limit ${key} must be a positive safe integer`);
    }
  }
  return Object.freeze({ ...limits });
}

function requireProcessor(processor) {
  if (typeof processor?.process !== "function") {
    throw new TypeError("A provider-neutral document processor is required");
  }
  return processor;
}

export function createEphemeralDocumentGateway({
  assertAuthenticatedSubject,
  authorizeReviewSession,
  processor,
  timeoutMs = 30_000,
  limits = DEFAULT_DOCUMENT_LIMITS,
  logger = Object.freeze({ log() {} }),
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const configuredProcessor = requireProcessor(processor);
  const configuredLimits = validateLimits({ ...DEFAULT_DOCUMENT_LIMITS, ...limits });
  if (typeof authorizeReviewSession !== "function") {
    throw new TypeError("An active review-session authorizer is required");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs must be a positive safe integer");
  }
  if (typeof logger?.log !== "function") throw new TypeError("A structured logger is required");

  return Object.freeze({
    async submit({ subject, reviewSessionId, input, declaredMimeType } = {}) {
      let authenticatedDoctor;
      try {
        authenticatedDoctor = requireRole(subject, ROLES.DOCTOR);
        authorizeReviewSession(authenticatedDoctor, reviewSessionId);
      } catch (error) {
        logger.log("document.ingestion.rejected", {
          action: "INGEST_DOCUMENT",
          outcome: "REJECTED",
          mediaType: MEDIA_TYPES[declaredMimeType] ?? "UNKNOWN",
          failureCategory: "AUTHORIZATION_REJECTED",
        });
        throw error;
      }

      try {
        validateDocument(input, declaredMimeType, configuredLimits);
      } catch (error) {
        logger.log("document.ingestion.rejected", {
          action: "INGEST_DOCUMENT",
          outcome: "REJECTED",
          mediaType: MEDIA_TYPES[declaredMimeType] ?? "UNKNOWN",
          failureCategory: error.code ?? DOCUMENT_ERROR_CODES.INVALID_DOCUMENT,
        });
        throw error;
      }

      const workingInput = input.slice();
      const abortController = new AbortController();
      let timer;
      const processorPromise = Promise.resolve().then(() => configuredProcessor.process(Object.freeze({
        input: workingInput,
        mimeType: declaredMimeType,
        signal: abortController.signal,
        context: Object.freeze({
          ownerDoctorId: authenticatedDoctor.subjectId,
          reviewSessionId,
        }),
      })));
      const timeoutPromise = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          reject(timedOut());
          abortController.abort();
        }, timeoutMs);
      });

      try {
        await Promise.race([processorPromise, timeoutPromise]);
        logger.log("document.ingestion.completed", {
          action: "INGEST_DOCUMENT",
          outcome: "COMPLETED",
          mediaType: MEDIA_TYPES[declaredMimeType],
        });
        return Object.freeze({ reviewSessionId, status: "PROCESSED" });
      } catch (error) {
        const safeError = error?.code === DOCUMENT_ERROR_CODES.PROCESSING_TIMEOUT ? error : failed();
        logger.log("document.ingestion.failed", {
          action: "INGEST_DOCUMENT",
          outcome: safeError.code === DOCUMENT_ERROR_CODES.PROCESSING_TIMEOUT ? "TIMED_OUT" : "FAILED",
          mediaType: MEDIA_TYPES[declaredMimeType],
          failureCategory: safeError.code,
        });
        throw safeError;
      } finally {
        clearTimeout(timer);
        workingInput.fill(0);
      }
    },
  });
}
