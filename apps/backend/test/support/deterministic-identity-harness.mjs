import { ROLES } from "@medsup/contracts";
import { ERROR_CODES, FoundationError } from "../../src/identity/errors.mjs";

export const TEST_IDENTITIES = Object.freeze({
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

export function createDeterministicIdentityHarness(identities = TEST_IDENTITIES) {
  const authenticatedSubjects = new WeakSet();
  const records = Object.values(identities);

  return Object.freeze({
    async authenticate(credential) {
      const record = records.find(({ credential: expected }) =>
        credential?.login === expected.login && credential?.secret === expected.secret);
      if (!record) {
        throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
      }
      const subject = Object.freeze({ subjectId: record.subjectId, role: record.role });
      authenticatedSubjects.add(subject);
      return subject;
    },

    assertAuthenticatedSubject(subject) {
      if (!subject || !authenticatedSubjects.has(subject)) {
        throw new FoundationError(
          ERROR_CODES.INVALID_AUTHENTICATED_SUBJECT,
          "Authenticated subject is invalid",
        );
      }
      return subject;
    },
  });
}

const identity = createDeterministicIdentityHarness();
export const authenticateTestIdentity = identity.authenticate;
export const assertTestAuthenticatedSubject = identity.assertAuthenticatedSubject;