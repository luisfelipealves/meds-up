import { ROLES } from "@medsup/contracts";
import { ERROR_CODES, FoundationError } from "./errors.mjs";

export { ROLES };

const VALID_ROLES = new Set(Object.values(ROLES));
const authenticatedSubjects = new WeakSet();

function mintAuthenticatedSubject({ subjectId, role }) {
  if (typeof subjectId !== "string" || subjectId.length === 0 || !VALID_ROLES.has(role)) {
    throw new FoundationError(ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT, "Authenticated subject is invalid");
  }

  const subject = Object.freeze({ subjectId, role });
  authenticatedSubjects.add(subject);
  return subject;
}

export function createIdentityCompositionRoot(identityProvider) {
  if (!identityProvider || typeof identityProvider.authenticate !== "function") {
    throw new TypeError("A trusted identity provider is required");
  }

  return Object.freeze({
    async authenticate(credential) {
      try {
        return mintAuthenticatedSubject(await identityProvider.authenticate(credential));
      } catch {
        throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
      }
    },
  });
}

export function assertAuthenticatedSubject(subject) {
  if (!subject || !authenticatedSubjects.has(subject)) {
    throw new FoundationError(ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT, "Authenticated subject is invalid");
  }
  return subject;
}

export function requireRole(subject, expectedRole) {
  assertAuthenticatedSubject(subject);
  if (subject.role !== expectedRole) {
    throw new FoundationError(ERROR_CODES.ROLE_FORBIDDEN, "Authenticated role is not permitted");
  }
  return subject;
}
