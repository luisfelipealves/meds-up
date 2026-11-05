import { ERROR_CODES } from "@medsup/contracts";

export const LOG_EVENTS = Object.freeze({
  IDENTITY_AUTHENTICATION_FAILED: "identity.authentication.failed",
  DOCUMENT_INGESTION_COMPLETED: "document.ingestion.completed",
  DOCUMENT_INGESTION_FAILED: "document.ingestion.failed",
  DOCUMENT_INGESTION_REJECTED: "document.ingestion.rejected",
  OCR_PROPOSAL_COMPLETED: "ocr.proposal.completed",
  OCR_PROPOSAL_FAILED: "ocr.proposal.failed",
  OCR_PROPOSAL_DISCARDED: "ocr.proposal.discarded",
});

export const LOG_ACTIONS = Object.freeze({
  AUTHENTICATE: "AUTHENTICATE",
  INGEST_DOCUMENT: "INGEST_DOCUMENT",
  EXTRACT_PROPOSAL: "EXTRACT_PROPOSAL",
  DISCARD_PROPOSAL: "DISCARD_PROPOSAL",
});

export const LOG_OUTCOMES = Object.freeze({
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REJECTED: "REJECTED",
  TIMED_OUT: "TIMED_OUT",
});

const DOCUMENT_MEDIA_TYPES = new Set(["PDF", "JPEG", "PNG", "UNKNOWN"]);
const DOCUMENT_FAILURE_CATEGORIES = new Set([
  "UNSUPPORTED_MEDIA_TYPE",
  "INVALID_DOCUMENT",
  "DOCUMENT_LIMIT_EXCEEDED",
  "PROCESSING_FAILED",
  "PROCESSING_TIMEOUT",
  "AUTHORIZATION_REJECTED",
]);
const PROPOSAL_FAILURE_CATEGORIES = new Set([
  "EXTRACTION_FAILED",
  "INVALID_RESPONSE",
  "SESSION_ENDED",
]);

const VALUE_VALIDATORS = Object.freeze({
  action: (value) => Object.values(LOG_ACTIONS).includes(value),
  outcome: (value) => Object.values(LOG_OUTCOMES).includes(value),
  errorCode: (value) => Object.values(ERROR_CODES).includes(value),
  mediaType: (value) => DOCUMENT_MEDIA_TYPES.has(value),
  failureCategory: (value) => DOCUMENT_FAILURE_CATEGORIES.has(value) || PROPOSAL_FAILURE_CATEGORIES.has(value),
  durationMs: (value) => Number.isSafeInteger(value) && value >= 0 && value <= 86_400_000,
});

const VALID_EVENTS = new Set(Object.values(LOG_EVENTS));

export function createStructuredLogger({ sink, clock = Date.now }) {
  if (typeof sink !== "function") throw new TypeError("A structured log sink is required");

  return Object.freeze({
    log(event, fields = {}) {
      if (!VALID_EVENTS.has(event)) {
        throw new TypeError("Log event is not allow-listed");
      }
      if (fields === null || typeof fields !== "object" || Array.isArray(fields)) {
        throw new TypeError("Structured log fields must be an object");
      }

      for (const [key, value] of Object.entries(fields)) {
        const validate = VALUE_VALIDATORS[key];
        if (!validate || !validate(value)) {
          throw new TypeError(`Structured log field is not allow-listed: ${key}`);
        }
      }

      sink(Object.freeze({
        timestamp: new Date(clock()).toISOString(),
        event,
        ...fields,
      }));
    },
  });
}
