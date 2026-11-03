import { ROLES } from "@medsup/contracts";
import { ERROR_CODES, FoundationError } from "./errors.mjs";

export { ROLES };

export function createRoleGuard(assertAuthenticatedSubject) {
  if (typeof assertAuthenticatedSubject !== "function") {
    throw new TypeError("A trusted authenticated-subject assertion is required");
  }

  return function requireRole(subject, expectedRole) {
    assertAuthenticatedSubject(subject);
    if (subject.role !== expectedRole) {
      throw new FoundationError(ERROR_CODES.ROLE_FORBIDDEN, "Authenticated role is not permitted");
    }
    return subject;
  };
}
