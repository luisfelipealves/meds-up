import { ROLES } from "@medsup/contracts";

import { createIdentityCompositionRoot } from "../../src/identity/identity-port.mjs";

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

const records = Object.values(TEST_IDENTITIES);
const identity = createIdentityCompositionRoot(Object.freeze({
  async authenticate(credential) {
    const record = records.find(({ credential: expected }) =>
      credential?.login === expected.login && credential?.secret === expected.secret);
    if (!record) throw new Error("Authentication failed");
    return Object.freeze({ subjectId: record.subjectId, role: record.role });
  },
}));

export const authenticateTestIdentity = identity.authenticate;