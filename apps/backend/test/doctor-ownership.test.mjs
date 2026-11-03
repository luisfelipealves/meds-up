import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "@medsup/contracts";
import { createDoctorOwnershipService } from "../src/authorization/doctor-ownership.mjs";
import { createDeterministicIdentityHarness } from "./support/deterministic-identity-harness.mjs";

const IDENTITIES = Object.freeze({
  DOCTOR_A: Object.freeze({
    subjectId: "doctor-owner-0001",
    role: ROLES.DOCTOR,
    credential: Object.freeze({ login: "doctor-a@example.invalid", secret: "doctor-a-test-secret" }),
  }),
  DOCTOR_B: Object.freeze({
    subjectId: "doctor-owner-0002",
    role: ROLES.DOCTOR,
    credential: Object.freeze({ login: "doctor-b@example.invalid", secret: "doctor-b-test-secret" }),
  }),
});

function createOwnedRepository(records) {
  const items = new Map(records.map((record) => [record.id, structuredClone(record)]));
  return Object.freeze({
    getById(id) {
      const value = items.get(id);
      return value === undefined ? null : structuredClone(value);
    },
    listByOwner(ownerDoctorId) {
      return [...items.values()]
        .filter((item) => item.ownerDoctorId === ownerDoctorId)
        .map((item) => structuredClone(item));
    },
    mutateByOwner(id, ownerDoctorId, mutation) {
      const current = items.get(id);
      if (current === undefined || current.ownerDoctorId !== ownerDoctorId) return null;
      const updated = { ...current, ...structuredClone(mutation), ownerDoctorId };
      items.set(id, updated);
      return structuredClone(updated);
    },
  });
}

function repositories(overrides = {}) {
  const empty = () => createOwnedRepository([]);
  return {
    activeReviewSessions: empty(),
    confirmedPrescriptions: empty(),
    prescriptionVersions: empty(),
    auditReferences: empty(),
    claimControls: empty(),
    ...overrides,
  };
}

async function fixture(overrides = {}) {
  const authority = createDeterministicIdentityHarness(IDENTITIES);
  return {
    doctorA: await authority.authenticate(IDENTITIES.DOCTOR_A.credential),
    doctorB: await authority.authenticate(IDENTITIES.DOCTOR_B.credential),
    service: createDoctorOwnershipService({
      assertAuthenticatedSubject: authority.assertAuthenticatedSubject,
      repositories: repositories(overrides),
    }),
  };
}

test("cross-doctor direct prescription identifiers use the same content-free NOT_FOUND as missing identifiers", async () => {
  const prescription = {
    id: "prescription_0000000002",
    ownerDoctorId: IDENTITIES.DOCTOR_B.subjectId,
    status: "ACTIVE",
  };
  const { doctorA, service } = await fixture({
    confirmedPrescriptions: createOwnedRepository([prescription]),
  });

  for (const id of [prescription.id, "prescription_missing_0000"]) {
    assert.throws(
      () => service.getConfirmedPrescription(doctorA, id),
      {
        code: "NOT_FOUND",
        message: "The resource was not found.",
      },
    );
  }
});

test("doctor lists include only owned resources and only active review sessions", async () => {
  const owned = (id, ownerDoctorId, extra = {}) => ({ id, ownerDoctorId, ...extra });
  const resources = {
    activeReviewSessions: [
      owned("review_session_00000001", IDENTITIES.DOCTOR_A.subjectId, { status: "ACTIVE" }),
      owned("review_session_00000002", IDENTITIES.DOCTOR_B.subjectId, { status: "ACTIVE" }),
      owned("review_session_00000003", IDENTITIES.DOCTOR_A.subjectId, { status: "EXPIRED" }),
    ],
    confirmedPrescriptions: [
      owned("prescription_00000001", IDENTITIES.DOCTOR_A.subjectId),
      owned("prescription_00000002", IDENTITIES.DOCTOR_B.subjectId),
    ],
    prescriptionVersions: [
      owned("version_000000000001", IDENTITIES.DOCTOR_A.subjectId),
      owned("version_000000000002", IDENTITIES.DOCTOR_B.subjectId),
    ],
    auditReferences: [
      owned("audit_reference_00001", IDENTITIES.DOCTOR_A.subjectId),
      owned("audit_reference_00002", IDENTITIES.DOCTOR_B.subjectId),
    ],
    claimControls: [
      owned("claim_control_000001", IDENTITIES.DOCTOR_A.subjectId),
      owned("claim_control_000002", IDENTITIES.DOCTOR_B.subjectId),
    ],
  };
  const { doctorA, service } = await fixture(Object.fromEntries(
    Object.entries(resources).map(([name, records]) => [name, createOwnedRepository(records)]),
  ));

  assert.deepEqual(service.listActiveReviewSessions(doctorA).map(({ id }) => id), ["review_session_00000001"]);
  assert.deepEqual(service.listConfirmedPrescriptions(doctorA).map(({ id }) => id), ["prescription_00000001"]);
  assert.deepEqual(service.listPrescriptionVersions(doctorA).map(({ id }) => id), ["version_000000000001"]);
  assert.deepEqual(service.listAuditReferences(doctorA).map(({ id }) => id), ["audit_reference_00001"]);
  assert.deepEqual(service.listClaimControls(doctorA).map(({ id }) => id), ["claim_control_000001"]);
});

test("every covered direct read and mutation denies cross-doctor identifiers without revealing existence", async () => {
  const cases = [
    ["ActiveReviewSession", "activeReviewSessions", { id: "review_session_00000002", status: "ACTIVE" }],
    ["ConfirmedPrescription", "confirmedPrescriptions", { id: "prescription_00000002" }],
    ["PrescriptionVersion", "prescriptionVersions", { id: "version_000000000002" }],
    ["AuditReference", "auditReferences", { id: "audit_reference_00002" }],
    ["ClaimControl", "claimControls", { id: "claim_control_000002" }],
  ];
  const overrides = Object.fromEntries(cases.map(([, repositoryName, record]) => [
    repositoryName,
    createOwnedRepository([{ ...record, ownerDoctorId: IDENTITIES.DOCTOR_B.subjectId }]),
  ]));
  const { doctorA, service } = await fixture(overrides);

  for (const [resourceName, , record] of cases) {
    for (const operation of [
      () => service[`get${resourceName}`](doctorA, record.id),
      () => service[`mutate${resourceName}`](doctorA, record.id, { status: "REVOKED" }),
    ]) {
      assert.throws(operation, {
        code: "NOT_FOUND",
        message: "The resource was not found.",
      });
    }
  }
});

test("owned mutations cannot transfer ownership and inactive review sessions are content-free NOT_FOUND", async () => {
  const session = {
    id: "review_session_00000001",
    ownerDoctorId: IDENTITIES.DOCTOR_A.subjectId,
    status: "ACTIVE",
  };
  const expired = {
    id: "review_session_00000003",
    ownerDoctorId: IDENTITIES.DOCTOR_A.subjectId,
    status: "EXPIRED",
  };
  const { doctorA, service } = await fixture({
    activeReviewSessions: createOwnedRepository([session, expired]),
  });

  const updated = service.mutateActiveReviewSession(doctorA, session.id, {
    status: "COMPLETED",
    ownerDoctorId: IDENTITIES.DOCTOR_B.subjectId,
  });
  assert.equal(updated.ownerDoctorId, IDENTITIES.DOCTOR_A.subjectId);
  assert.equal(updated.status, "COMPLETED");
  assert.throws(() => service.getActiveReviewSession(doctorA, expired.id), {
    code: "NOT_FOUND",
    message: "The resource was not found.",
  });
});

test("ownership API requires injected authenticated doctor subjects and exposes no reminder-history query", async () => {
  const authority = createDeterministicIdentityHarness({
    ...IDENTITIES,
    PATIENT: Object.freeze({
      subjectId: "patient-test-000001",
      role: ROLES.PATIENT,
      credential: Object.freeze({ login: "patient@example.invalid", secret: "patient-test-secret" }),
    }),
  });
  const patient = await authority.authenticate({ login: "patient@example.invalid", secret: "patient-test-secret" });
  const service = createDoctorOwnershipService({
    assertAuthenticatedSubject: authority.assertAuthenticatedSubject,
    repositories: repositories(),
  });

  assert.throws(() => service.listConfirmedPrescriptions(patient), { code: "ROLE_FORBIDDEN" });
  assert.throws(
    () => service.listConfirmedPrescriptions({ subjectId: IDENTITIES.DOCTOR_A.subjectId, role: ROLES.DOCTOR }),
    { code: "INVALID_AUTHENTICATED_SUBJECT" },
  );
  assert.equal(Object.keys(service).some((name) => /reminder|history|adherence/i.test(name)), false);
});
