import { ERROR_CODES, createErrorEnvelope } from "@medsup/contracts";

export { ERROR_CODES };

export class FoundationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FoundationError";
    this.code = code;
  }
}

export function toErrorEnvelope(error, requestId) {
  const known = error instanceof FoundationError;
  return createErrorEnvelope(known ? error.code : ERROR_CODES.INTERNAL_ERROR, requestId);
}
