export const ERROR_CODES = Object.freeze({
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  INVALID_AUTHENTICATED_SUBJECT: "INVALID_AUTHENTICATED_SUBJECT",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_REVOKED: "SESSION_REVOKED",
  DEVICE_REVOKED: "DEVICE_REVOKED",
});

export class FoundationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FoundationError";
    this.code = code;
  }
}

export function toErrorEnvelope(error) {
  const known = error instanceof FoundationError;
  return Object.freeze({
    error: Object.freeze({
      code: known ? error.code : "INTERNAL_ERROR",
      message: known ? error.message : "An unexpected error occurred",
      retryable: false,
    }),
  });
}
