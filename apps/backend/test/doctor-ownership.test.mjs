import assert from "node:assert/strict";
import test from "node:test";

import { ROLES } from "@medsup/contracts";
import { createDoctorOwnershipService } from "../src/authorization/doctor-ownership.mjs";
import { createDeterministicIdentityHarness } from "./support/deterministic-identity-harness.mjs";

const IDENTITIES = Object.freeze({
  DOCTOR_A: Object.freeze({ subjectId: "doctor-owner-0001", role: ROLES.DOCTOR, credential: Object.freeze({ login: "doctor-a@example.invalid", secret: "doctor-a-test-secret" }) }),
  DOCTOR_B: Object.freeze({ subjectId: "doctor-owner-0002", role: ROLES.DOCTOR, credential: Object.freeze({ login: "doctor-b@example.invalid", secret: "doctor-b-test-secret" }) }),
});

function projection(record, ownerDoctorId) {
  return { record: structuredClone(record), authorization: { ownerDoctorId } };
}

function entry(record, ownerDoctorId) { return { record, ownerDoctorId }; }

function createOwnedRepository(entries) {
  const items = new Map(entries.map(({ record, ownerDoctorId }) => [record.id ?? record.prescriptionId ?? record.auditReferenceId, projection(record, ownerDoctorId)]));
  return Object.freeze({
    getById(id) { const value = items.get(id); return value === undefined ? null : structuredClone(value); },
    listByOwner(ownerDoctorId) { return [...items.values()].filter((item) => item.authorization.ownerDoctorId === ownerDoctorId).map((item) => structuredClone(item)); },
    mutateByOwner(id, ownerDoctorId, mutation, options = {}) {
      const current = items.get(id);
      if (current === undefined || current.authorization.ownerDoctorId !== ownerDoctorId) return null;
      if (options.activeOnly && current.record.status !== "ACTIVE") return null;
      const updated = { ...current.record, ...structuredClone(mutation) };
      items.set(id, projection(updated, ownerDoctorId));
      return structuredClone(items.get(id));
    },
  });
}

function repositories(overrides = {}) {
  const empty = () => createOwnedRepository([]);
  return { activeReviewSessions: empty(), confirmedPrescriptions: empty(), prescriptionVersions: empty(), auditReferences: empty(), claimControls: empty(), ...overrides };
}

async function fixture(overrides = {}) {
  const authority = createDeterministicIdentityHarness(IDENTITIES);
  return {
    doctorA: await authority.authenticate(IDENTITIES.DOCTOR_A.credential),
    doctorB: await authority.authenticate(IDENTITIES.DOCTOR_B.credential),
    service: createDoctorOwnershipService({ assertAuthenticatedSubject: authority.assertAuthenticatedSubject, repositories: repositories(overrides) }),
  };
}

const notFound = { code: "NOT_FOUND", message: "The resource was not found." };

test("contract-shaped versions and audit references use explicit internal authorization projections", async () => {
  const version = { id: "version_000000000001", apiVersion: "v1", schemaVersion: 1, lifecycle: "DOCTOR_CONFIRMED_VERSION", prescriptionId: "prescription_00000001", prescriptionVersion: 1, resourceVersion: 1, confirmedByDoctorId: IDENTITIES.DOCTOR_A.subjectId, confirmedAt: "2026-11-03T15:50:00Z", createdAt: "2026-11-03T15:50:00Z", clinicalContent: { medications: [{ medicationName: "Example", dose: "1 tablet" }] } };
  const audit = { id: "audit_reference_00001", apiVersion: "v1", schemaVersion: 1, auditReferenceId: "audit_reference_00001", eventType: "DOCTOR_CONFIRMATION", outcome: "COMPLETED", occurredAt: "2026-11-03T15:50:00Z", securityCorrelationId: "correlation_0000001" };
  const { doctorA, service } = await fixture({ prescriptionVersions: createOwnedRepository([entry(version, IDENTITIES.DOCTOR_A.subjectId)]), auditReferences: createOwnedRepository([entry(audit, IDENTITIES.DOCTOR_A.subjectId)]) });
  assert.deepEqual(service.getPrescriptionVersion(doctorA, version.id), version);
  assert.deepEqual(service.getAuditReference(doctorA, audit.id), audit);
  assert.deepEqual(service.listPrescriptionVersions(doctorA), [version]);
  assert.deepEqual(service.listAuditReferences(doctorA), [audit]);
  assert.deepEqual(service.mutatePrescriptionVersion(doctorA, version.id, { resourceVersion: 2 }), { ...version, resourceVersion: 2 });
  assert.deepEqual(service.mutateAuditReference(doctorA, audit.id, { outcome: "DENIED" }), { ...audit, outcome: "DENIED" });
});

test("cross-doctor direct identifiers and missing identifiers share content-free NOT_FOUND", async () => {
  const records = [["ActiveReviewSession", "activeReviewSessions", { id: "review_session_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", status: "ACTIVE" }], ["ConfirmedPrescription", "confirmedPrescriptions", { id: "prescription_00000002" }], ["PrescriptionVersion", "prescriptionVersions", { id: "version_000000000002", prescriptionId: "prescription_00000002", confirmedByDoctorId: IDENTITIES.DOCTOR_B.subjectId }], ["AuditReference", "auditReferences", { id: "audit_reference_00002", auditReferenceId: "audit_reference_00002" }], ["ClaimControl", "claimControls", { id: "claim_control_000002" }]];
  const overrides = Object.fromEntries(records.map(([, repositoryName, record]) => [repositoryName, createOwnedRepository([entry(record, IDENTITIES.DOCTOR_B.subjectId)])]));
  const { doctorA, service } = await fixture(overrides);
  for (const [resourceName, , record] of records) {
    for (const operation of [() => service[`get${resourceName}`](doctorA, record.id), () => service[`mutate${resourceName}`](doctorA, record.id, { status: "REVOKED" })]) assert.throws(operation, notFound);
    assert.throws(() => service[`get${resourceName}`](doctorA, "missing-resource-0000"), notFound);
  }
});

test("lists are owner-scoped and active sessions return metadata only", async () => {
  const sentinel = "SENTINEL_MUST_NOT_ESCAPE";
  const resources = {
    activeReviewSessions: [entry({ id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "ACTIVE", createdAt: "2026-11-03T15:00:00Z", document: sentinel, rawOcr: sentinel, unconfirmedProposal: sentinel }, IDENTITIES.DOCTOR_A.subjectId), entry({ id: "review_session_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", status: "ACTIVE" }, IDENTITIES.DOCTOR_B.subjectId), entry({ id: "review_session_cccccccccccccccccccccccccccccccc", status: "EXPIRED" }, IDENTITIES.DOCTOR_A.subjectId)],
    confirmedPrescriptions: [entry({ id: "prescription_00000001" }, IDENTITIES.DOCTOR_A.subjectId), entry({ id: "prescription_00000002" }, IDENTITIES.DOCTOR_B.subjectId)],
    prescriptionVersions: [entry({ id: "version_000000000001", confirmedByDoctorId: IDENTITIES.DOCTOR_A.subjectId }, IDENTITIES.DOCTOR_A.subjectId), entry({ id: "version_000000000002" }, IDENTITIES.DOCTOR_B.subjectId)],
    auditReferences: [entry({ id: "audit_reference_00001", auditReferenceId: "audit_reference_00001" }, IDENTITIES.DOCTOR_A.subjectId), entry({ id: "audit_reference_00002", auditReferenceId: "audit_reference_00002" }, IDENTITIES.DOCTOR_B.subjectId)],
    claimControls: [entry({ id: "claim_control_000001" }, IDENTITIES.DOCTOR_A.subjectId), entry({ id: "claim_control_000002" }, IDENTITIES.DOCTOR_B.subjectId)],
  };
  const { doctorA, service } = await fixture(Object.fromEntries(Object.entries(resources).map(([name, records]) => [name, createOwnedRepository(records)])));
  assert.deepEqual(service.listActiveReviewSessions(doctorA), [{ id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "ACTIVE", createdAt: "2026-11-03T15:00:00Z" }]);
  assert.equal(JSON.stringify(service.listActiveReviewSessions(doctorA)).includes(sentinel), false);
  assert.deepEqual(service.listConfirmedPrescriptions(doctorA).map(({ id }) => id), ["prescription_00000001"]);
  assert.deepEqual(service.listPrescriptionVersions(doctorA).map(({ id }) => id), ["version_000000000001"]);
  assert.deepEqual(service.listAuditReferences(doctorA).map(({ id }) => id), ["audit_reference_00001"]);
  assert.deepEqual(service.listClaimControls(doctorA).map(({ id }) => id), ["claim_control_000001"]);
});

test("active-session metadata rejects nested or invalid retained values on get, list, and mutation", async () => {
  const sentinel = "RAW_OCR_AI_UNCONFIRMED_PROPOSAL_SENTINEL";
  const malformedRecords = [
    { id: { document: sentinel }, status: "ACTIVE" },
    { id: sentinel, status: "ACTIVE" },
    { id: "review_session_dddddddddddddddddddddddddddddddd", status: "ACTIVE", reviewSessionId: sentinel },
    { id: "review_session_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", status: "ACTIVE", reviewSessionId: { rawOcr: sentinel } },
    { id: "review_session_ffffffffffffffffffffffffffffffff", status: ["ACTIVE", { document: sentinel }] },
    { id: "review_session_11111111111111111111111111111111", status: sentinel },
    { id: "review_session_22222222222222222222222222222222", status: "ACTIVE", createdAt: { unconfirmedProposal: sentinel } },
    { id: "review_session_33333333333333333333333333333333", status: "ACTIVE", updatedAt: sentinel },
    { id: "review_session_44444444444444444444444444444444", status: "ACTIVE", expiresAt: 42 },
    { id: "review_session_55555555555555555555555555555555", status: "ACTIVE", createdAt: "not-a-timestamp" },
  ];
  for (const record of malformedRecords) {
    const repository = createOwnedRepository([entry(record, IDENTITIES.DOCTOR_A.subjectId)]);
    const { doctorA, service } = await fixture({ activeReviewSessions: repository });
    assert.throws(() => service.getActiveReviewSession(doctorA, record.id), notFound);
    if (record.status === "ACTIVE") assert.throws(() => service.listActiveReviewSessions(doctorA), notFound);
    else assert.deepEqual(service.listActiveReviewSessions(doctorA), []);
    assert.throws(
      () => service.mutateActiveReviewSession(doctorA, record.id, { status: "COMPLETED" }),
      (error) => error.code === "NOT_FOUND" && !error.message.includes(sentinel),
    );
  }
});

test("mutation strips forged ownership and session payload fields before one atomic repository call", async () => {
  const received = [];
  let sideEffects = 0;
  const repository = Object.freeze({
    getById: () => projection({ id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "ACTIVE" }, IDENTITIES.DOCTOR_A.subjectId),
    listByOwner: () => [],
    mutateByOwner: (id, ownerDoctorId, mutation, options) => {
      received.push({ id, ownerDoctorId, mutation, options });
      if (mutation.ownerDoctorId || mutation.confirmedByDoctorId || mutation.document || mutation.rawOcr || mutation.unconfirmedProposal) { sideEffects += 1; return projection({ id, status: "ACTIVE" }, IDENTITIES.DOCTOR_B.subjectId); }
      return projection({ id, status: mutation.status }, ownerDoctorId);
    },
  });
  const { doctorA, service } = await fixture({ activeReviewSessions: repository });
  const updated = service.mutateActiveReviewSession(doctorA, "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { status: "COMPLETED", ownerDoctorId: IDENTITIES.DOCTOR_B.subjectId, confirmedByDoctorId: IDENTITIES.DOCTOR_B.subjectId, document: "SENTINEL_DOCUMENT", rawOcr: "SENTINEL_OCR", unconfirmedProposal: "SENTINEL_PROPOSAL" });
  assert.deepEqual(updated, { id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "COMPLETED" });
  assert.equal(sideEffects, 0);
  assert.deepEqual(received, [{ id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", ownerDoctorId: IDENTITIES.DOCTOR_A.subjectId, mutation: { status: "COMPLETED" }, options: { activeOnly: true } }]);
});

test("owned records preserve atomic mutateByOwner and inactive sessions remain NOT_FOUND", async () => {
  const active = { id: "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", status: "ACTIVE" };
  const expired = { id: "review_session_cccccccccccccccccccccccccccccccc", status: "EXPIRED" };
  const { doctorA, service } = await fixture({ activeReviewSessions: createOwnedRepository([entry(active, IDENTITIES.DOCTOR_A.subjectId), entry(expired, IDENTITIES.DOCTOR_A.subjectId)]) });
  assert.deepEqual(service.mutateActiveReviewSession(doctorA, active.id, { status: "COMPLETED" }), { ...active, status: "COMPLETED" });
  assert.throws(() => service.mutateActiveReviewSession(doctorA, expired.id, { status: "COMPLETED" }), notFound);
});

test("ownership API requires trusted authenticated doctor subjects and exposes no reminder-history query", async () => {
  const authority = createDeterministicIdentityHarness({ ...IDENTITIES, PATIENT: Object.freeze({ subjectId: "patient-test-000001", role: ROLES.PATIENT, credential: Object.freeze({ login: "patient@example.invalid", secret: "patient-test-secret" }) }) });
  const patient = await authority.authenticate({ login: "patient@example.invalid", secret: "patient-test-secret" });
  const service = createDoctorOwnershipService({ assertAuthenticatedSubject: authority.assertAuthenticatedSubject, repositories: repositories() });
  assert.throws(() => service.listConfirmedPrescriptions(patient), { code: "ROLE_FORBIDDEN" });
  assert.throws(() => service.listConfirmedPrescriptions({ subjectId: IDENTITIES.DOCTOR_A.subjectId, role: ROLES.DOCTOR }), { code: "INVALID_AUTHENTICATED_SUBJECT" });
  assert.equal(Object.keys(service).some((name) => /reminder|history|adherence/i.test(name)), false);
});
