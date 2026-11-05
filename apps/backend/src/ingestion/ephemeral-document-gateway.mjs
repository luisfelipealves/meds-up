import { ERROR_CODES, ROLES } from "@medsup/contracts";
import { FoundationError } from "../identity/errors.mjs";
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
const AUTHORIZATION_ERRORS = Object.freeze({
  [ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT]: "The authenticated subject is invalid.",
  [ERROR_CODES.ROLE_FORBIDDEN]: "The authenticated role is not permitted.",
  [ERROR_CODES.NOT_FOUND]: "The resource was not found.",
});
const PROCESSING_TIMEOUT = Symbol("processing-timeout");

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

function authorizationRejected(error) {
  const code = Object.hasOwn(AUTHORIZATION_ERRORS, error?.code) ? error.code : ERROR_CODES.NOT_FOUND;
  return new FoundationError(code, AUTHORIZATION_ERRORS[code]);
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

function crc32(input, start, end) {
  let crc = 0xffffffff;
  for (let offset = start; offset < end; offset += 1) {
    crc ^= input[offset];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunkType(input, offset) {
  return String.fromCharCode(input[offset], input[offset + 1], input[offset + 2], input[offset + 3]);
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
  if (input.byteLength < 57 || !matchesAt(input, PNG_SIGNATURE)) throw rejected();

  let offset = PNG_SIGNATURE.length;
  let seenHeader = false;
  let colorType;
  let seenPalette = false;
  let seenImageData = false;
  let imageDataEnded = false;
  let seenEnd = false;
  while (offset < input.byteLength) {
    if (input.byteLength - offset < 12) throw rejected();
    const length = readUint32(input, offset);
    const typeOffset = offset + 4;
    const dataOffset = typeOffset + 4;
    const dataEnd = dataOffset + length;
    const chunkEnd = dataEnd + 4;
    if (!Number.isSafeInteger(dataEnd) || chunkEnd > input.byteLength) throw rejected();
    if (readUint32(input, dataEnd) !== crc32(input, typeOffset, dataEnd)) throw rejected();

    const type = pngChunkType(input, typeOffset);
    if (!seenHeader) {
      if (type !== "IHDR" || length !== 13) throw rejected();
      const bitDepth = input[dataOffset + 8];
      colorType = input[dataOffset + 9];
      const validDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        !validDepths[colorType]?.includes(bitDepth)
        || input[dataOffset + 10] !== 0
        || input[dataOffset + 11] !== 0
        || ![0, 1].includes(input[dataOffset + 12])
      ) throw rejected();
      assertImageLimit(readUint32(input, dataOffset), readUint32(input, dataOffset + 4), limits.maxImagePixels);
      seenHeader = true;
    } else if (type === "IHDR") {
      throw rejected();
    } else if (type === "PLTE") {
      if (seenPalette || seenImageData || length === 0 || length > 768 || length % 3 !== 0) throw rejected();
      seenPalette = true;
    } else if (type === "IDAT") {
      if (length === 0 || seenEnd || imageDataEnded || (colorType === 3 && !seenPalette)) throw rejected();
      seenImageData = true;
    } else if (type === "IEND") {
      if (length !== 0 || !seenImageData || seenEnd || chunkEnd !== input.byteLength) throw rejected();
      seenEnd = true;
    } else if (seenEnd || !/^[A-Za-z]{4}$/.test(type) || type[0] === type[0].toUpperCase()) {
      throw rejected();
    } else if (seenImageData) {
      imageDataEnded = true;
    }
    offset = chunkEnd;
  }
  if (!seenHeader || !seenImageData || !seenEnd) throw rejected();
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
        throw authorizationRejected(error);
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
      const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
          abortController.abort();
          resolve(PROCESSING_TIMEOUT);
        }, timeoutMs);
      });

      try {
        const outcome = await Promise.race([processorPromise, timeoutPromise]);
        if (outcome === PROCESSING_TIMEOUT) {
          try {
            await processorPromise;
          } catch {
            // Cancellation settlement is intentionally hidden from callers.
          }
          throw timedOut();
        }
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
