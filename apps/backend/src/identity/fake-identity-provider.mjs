import { ERROR_CODES, FoundationError } from "./errors.mjs";
import { ROLES } from "./subject.mjs";

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

export function createDeterministicFakeIdentityProvider(identities = Object.values(SAFE_TEST_IDENTITIES)) {
  const records = identities.map(({ subjectId, role, credential }) => ({ subjectId, role, credential }));

  return Object.freeze({
    async authenticate(credential) {
      const record = records.find(({ credential: expected }) =>
        credential?.login === expected.login && credential?.secret === expected.secret);
      if (!record) {
        throw new FoundationError(ERROR_CODES.AUTHENTICATION_FAILED, "Authentication failed");
      }
      return Object.freeze({ subjectId: record.subjectId, role: record.role });
    },
  });
}
