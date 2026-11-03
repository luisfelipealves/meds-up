import { ROLES } from "@medsup/contracts";
import { ERROR_CODES, FoundationError } from "./errors.mjs";

export { ROLES };

const VALID_ROLES = new Set(Object.values(ROLES));
const authenticatedSubjects = new WeakSet();
const trustedIdentityProviders = new WeakSet();

export const SAFE_TEST_IDENTITIES = Object.freeze({
  DOCTOR: Object.freeze({
    subjectId: "test-doctor-0001",
    role: ROLES.DOCTOR,
    credential: Object.freeze({ login: "doctor@example.invalid", secret: "safe-test-doctor-secret" }),
  }),
  PATIENT: Object.freeze({
    subjectId: "test-patient-0001",
    role: ROLES.PATIENT,
    credential: Object.freeze({ login: "patient@example.invalid", secret: "safe-test-patient-secret" }),
  }),
});

function mintAuthenticatedSubject({ subjectId, role }) {
  if (typeof subjectId !== "string" || subjectId.length === 0 || !VALID_ROLES.has(role)) {
    throw new FoundationError(ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT, "Authenticated subject is invalid");
  }

  const subject = Object.freeze({ subjectId, role });
  authenticatedSubjects.add(subject);
  return subject;
}

export function createDeterministicFakeIdentityProvider() {
  const records = Object.values(SAFE_TEST_IDENTITIES);
  const provider = Object.freeze({
    async authenticate(credential) {
      const record = records.find(({ credential: expected }) =>
        credential?.login === expected.login && credential?.secret === expected.secret);
      if (!record) {
        throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
      }
      return Object.freeze({ subjectId: record.subjectId, role: record.role });
    },
  });
  trustedIdentityProviders.add(provider);
  return provider;
}

export async function authenticateSubject(identityProvider, credential) {
  if (!identityProvider || !trustedIdentityProviders.has(identityProvider)) {
    throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
  }

  try {
    return mintAuthenticatedSubject(await identityProvider.authenticate(credential));
  } catch {
    throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
  }
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
