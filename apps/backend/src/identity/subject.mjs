import { ROLES } from "@medsup/contracts";
import { ERROR_CODES, FoundationError } from "./errors.mjs";

export { ROLES };

const VALID_ROLES = new Set(Object.values(ROLES));
const authenticatedSubjects = new WeakSet();

export function createAuthenticatedSubject({ subjectId, role }) {
  if (typeof subjectId !== "string" || subjectId.length === 0 || !VALID_ROLES.has(role)) {
    throw new FoundationError(ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT, "Authenticated subject is invalid");
  }

  const subject = Object.freeze({ subjectId, role });
  authenticatedSubjects.add(subject);
  return subject;
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
