import { ERROR_CODES, FoundationError } from "./errors.mjs";
import { createAuthenticatedSubject } from "./subject.mjs";

export async function authenticateSubject(identityProvider, credential) {
  if (!identityProvider || typeof identityProvider.authenticate !== "function") {
    throw new TypeError("Identity provider must implement authenticate(credential)");
  }

  try {
    return createAuthenticatedSubject(await identityProvider.authenticate(credential));
  } catch {
    throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
  }
}
