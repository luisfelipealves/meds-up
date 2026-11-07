import assert from "node:assert/strict";
import test from "node:test";

import { API_VERSION, ROLES, SCHEMA_VERSION } from "@medsup/contracts";
import {
  createInMemoryConfirmedPrescriptionRepository,
  createPrescriptionConfirmationService,
} from "../src/prescriptions/prescription-confirmation.mjs";
import { createDeterministicIdentityHarness } from "./support/deterministic-identity-harness.mjs";

const IDENTITIES = Object.freeze({
  DOCTOR_A: Object.freeze({ subjectId: "doctor-owner-0001", role: ROLES.DOCTOR, credential: Object.freeze({ login: "doctor-a@example.invalid", secret: "doctor-a-test-secret" }) }),
  DOCTOR_B: Object.freeze({ subjectId: "doctor-owner-0002", role: ROLES.DOCTOR, credential: Object.freeze({ login: "doctor-b@example.invalid", secret: "doctor-b-test-secret" }) }),
  PATIENT: Object.freeze({ subjectId: "patient-test-000001", role: ROLES.PATIENT, credential: Object.freeze({ login: "patient@example.invalid", secret: "patient-test-secret" }) }),
});
const SESSION_A = "review_session_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SESSION_B = "review_session_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const CONTENT_1 = Object.freeze({ medications: [Object.freeze({ medicationName: "Example A", dose: "1 tablet" })] });
const CONTENT_2 = Object.freeze({ medications: [Object.freeze({ medicationName: "Example B", dose: "2 tablets" })] });

function deterministicIds() {
  let value = 0;
  return (kind) => `${kind}_${String(++value).padStart(24, "0")}`;
}

async function fixture({ createId = deterministicIds(), clock = () => Date.parse("2026-11-07T14:00:00Z"), confirmationBoundary } = {}) {
  const authority = createDeterministicIdentityHarness(IDENTITIES);
  const doctorA = await authority.authenticate(IDENTITIES.DOCTOR_A.credential);
  const doctorB = await authority.authenticate(IDENTITIES.DOCTOR_B.credential);
  const patient = await authority.authenticate(IDENTITIES.PATIENT.credential);
  const sessions = new Map([[SESSION_A, doctorA.subjectId], [SESSION_B, doctorB.subjectId]]);
  const completed = [];
  const repository = createInMemoryConfirmedPrescriptionRepository();
  const service = createPrescriptionConfirmationService({
    assertAuthenticatedSubject: authority.assertAuthenticatedSubject,
    confirmationBoundary: confirmationBoundary ?? Object.freeze({
      synchronous: true,
      confirmAtomically({ actor, reviewSessionId, prepare }) {
        if (sessions.get(reviewSessionId) !== actor.subjectId) throw Object.assign(new Error("not found"), { code: "NOT_FOUND" });
        const prepared = prepare();
        if (typeof prepared?.commit !== "function" || typeof prepared?.rollback !== "function") throw new TypeError("malformed prepared confirmation");
        try {
          const outcome = prepared.commit();
          sessions.delete(reviewSessionId);
          completed.push(reviewSessionId);
          return outcome;
        } catch (error) {
          prepared.rollback();
          throw error;
        }
      },
    }),
    repository,
    clock,
    createId,
  });
  return { service, repository, doctorA, doctorB, patient, completed };
}

function confirmation(ownerDoctorId, overrides = {}) {
  return {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: "idem_confirmation_00000001",
    reviewSessionId: SESSION_A,
    ownerDoctorId,
    confirmation: { decision: "CONFIRMED", confirmedByDoctorId: ownerDoctorId, confirmedAt: "2020-01-01T00:00:00Z" },
    correctedClinicalContent: CONTENT_1,
    ...overrides,
  };
}

function change(prescriptionId, ownerDoctorId, expectedResourceVersion, overrides = {}) {
  return {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: `idem_change_${String(expectedResourceVersion).padStart(16, "0")}`,
    prescriptionId,
    ownerDoctorId,
    expectedResourceVersion,
    confirmation: { decision: "CONFIRMED", confirmedByDoctorId: ownerDoctorId, confirmedAt: "2020-01-01T00:00:00Z" },
    correctedClinicalContent: CONTENT_2,
    ...overrides,
  };
}

function status(prescriptionId, ownerDoctorId, expectedResourceVersion, targetStatus, overrides = {}) {
  return {
    apiVersion: API_VERSION,
    schemaVersion: SCHEMA_VERSION,
    idempotencyKey: `idem_status_${String(expectedResourceVersion).padStart(16, "0")}`,
    prescriptionId,
    ownerDoctorId,
    expectedResourceVersion,
    targetStatus,
    requestedAt: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}

const errorCode = (code) => (error) => error?.code === code;

test("only an explicit corrected confirmation from the owning trusted doctor persists a prescription", async () => {
  const { service, doctorA, doctorB, patient, completed } = await fixture();
  await assert.rejects(() => service.confirm(patient, confirmation(doctorA.subjectId)), errorCode("ROLE_FORBIDDEN"));
  await assert.rejects(() => service.confirm(doctorB, confirmation(doctorB.subjectId)), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.confirm(doctorA, confirmation(doctorB.subjectId)), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.confirm(doctorA, { ...confirmation(doctorA.subjectId), confirmation: { decision: "PROPOSED", confirmedByDoctorId: doctorA.subjectId, confirmedAt: "2020-01-01T00:00:00Z" } }), errorCode("VALIDATION_FAILED"));
  assert.deepEqual(service.listPrescriptions(doctorA), []);

  const result = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  assert.equal(result.prescription.ownerDoctorId, doctorA.subjectId);
  assert.equal(result.prescription.status, "ACTIVE");
  assert.equal(result.version.prescriptionVersion, 1);
  assert.deepEqual(result.version.clinicalContent, CONTENT_1);
  assert.equal(result.version.confirmedAt, "2026-11-07T14:00:00.000Z");
  assert.equal(result.audit.actorDoctorId, doctorA.subjectId);
  assert.equal(result.audit.occurredAt, "2026-11-07T14:00:00.000Z");
  assert.deepEqual(completed, [SESSION_A]);
});

test("confirmation persists no proposal, source document, raw OCR, provenance, or confidence", async () => {
  const { service, repository, doctorA } = await fixture();
  const result = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  const snapshot = repository.inspectForTests();
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes("SESSION_ONLY_UNTRUSTED"), false);
  assert.equal(/proposal|document|rawOcr|rawAi|provenance|confidence/i.test(serialized), false);
  assert.deepEqual(snapshot.versions[0].clinicalContent, CONTENT_1);
  assert.equal(result.version.clinicalContent.medications[0].medicationName, "Example A");
});

test("confirmed versions are immutable and clinical changes append audit-linked versions", async () => {
  const { service, doctorA } = await fixture();
  const created = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  created.version.clinicalContent.medications[0].dose = "tampered";

  const changed = await service.changeClinicalContent(
    doctorA,
    change(created.prescription.prescriptionId, doctorA.subjectId, 1),
  );
  const versions = service.listVersions(doctorA, created.prescription.prescriptionId);
  assert.deepEqual(versions.map((item) => item.prescriptionVersion), [1, 2]);
  assert.equal(versions[0].clinicalContent.medications[0].dose, "1 tablet");
  assert.equal(versions[1].clinicalContent.medications[0].dose, "2 tablets");
  assert.equal(changed.prescription.currentPrescriptionVersion, 2);
  assert.equal(changed.prescription.resourceVersion, 2);
  assert.equal(changed.audit.previousPrescriptionVersion, 1);
  assert.equal(changed.audit.prescriptionVersion, 2);
  assert.equal(changed.audit.auditReferenceId, changed.version.auditReferenceId);
  assert.equal(changed.version.previousPrescriptionVersion, 1);
});

test("ownership and optimistic concurrency protect reads, clinical changes, and status transitions", async () => {
  const { service, doctorA, doctorB } = await fixture();
  const created = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  const id = created.prescription.prescriptionId;
  assert.throws(() => service.getPrescription(doctorB, id), errorCode("NOT_FOUND"));
  assert.throws(() => service.listVersions(doctorB, id), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.changeClinicalContent(doctorB, change(id, doctorB.subjectId, 1)), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.transitionStatus(doctorB, status(id, doctorB.subjectId, 1, "SUSPENDED")), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.transitionStatus(doctorA, status(id, doctorB.subjectId, 1, "SUSPENDED")), errorCode("NOT_FOUND"));
  await assert.rejects(() => service.changeClinicalContent(doctorA, change(id, doctorA.subjectId, 2)), errorCode("STALE_RESOURCE_VERSION"));

  await service.changeClinicalContent(doctorA, change(id, doctorA.subjectId, 1));
  await assert.rejects(() => service.transitionStatus(doctorA, status(id, doctorA.subjectId, 1, "SUSPENDED")), errorCode("STALE_RESOURCE_VERSION"));
  assert.equal(service.getPrescription(doctorA, id).resourceVersion, 2);
});

test("concurrent clinical changes allow exactly one expected resource version to win", async () => {
  const { service, doctorA } = await fixture();
  const created = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  const id = created.prescription.prescriptionId;
  const first = change(id, doctorA.subjectId, 1, { idempotencyKey: "idem_concurrent_change_0001" });
  const second = change(id, doctorA.subjectId, 1, {
    idempotencyKey: "idem_concurrent_change_0002",
    correctedClinicalContent: { medications: [{ medicationName: "Example C", dose: "3 tablets" }] },
  });
  const outcomes = await Promise.allSettled([
    service.changeClinicalContent(doctorA, first),
    service.changeClinicalContent(doctorA, second),
  ]);
  assert.equal(outcomes.filter(({ status: state }) => state === "fulfilled").length, 1);
  const rejected = outcomes.find(({ status: state }) => state === "rejected");
  assert.equal(rejected.reason.code, "STALE_RESOURCE_VERSION");
  assert.equal(service.listVersions(doctorA, id).length, 2);
});

test("idempotency replays the same result and rejects key reuse for different content", async () => {
  const { service, doctorA } = await fixture();
  const command = confirmation(doctorA.subjectId);
  const first = await service.confirm(doctorA, command);
  const replay = await service.confirm(doctorA, structuredClone(command));
  assert.deepEqual(replay, first);
  await assert.rejects(
    () => service.confirm(doctorA, { ...command, correctedClinicalContent: CONTENT_2 }),
    errorCode("IDEMPOTENCY_CONFLICT"),
  );
  assert.equal(service.listPrescriptions(doctorA).length, 1);
});

test("suspension and cancellation emit monotonic downstream events and cancellation is terminal", async () => {
  const { service, doctorA } = await fixture();
  const created = await service.confirm(doctorA, confirmation(doctorA.subjectId));
  const id = created.prescription.prescriptionId;
  const suspended = await service.transitionStatus(doctorA, status(id, doctorA.subjectId, 1, "SUSPENDED"));
  assert.equal(suspended.prescription.status, "SUSPENDED");
  assert.equal(suspended.statusEvent.previousStatus, "ACTIVE");
  assert.equal(suspended.statusEvent.status, "SUSPENDED");
  assert.equal(suspended.statusEvent.resourceVersion, 2);
  assert.equal(suspended.audit.actorDoctorId, doctorA.subjectId);

  const cancelled = await service.transitionStatus(doctorA, status(id, doctorA.subjectId, 2, "CANCELLED"));
  assert.equal(cancelled.prescription.status, "CANCELLED");
  assert.equal(cancelled.statusEvent.serverVersion > suspended.statusEvent.serverVersion, true);
  assert.deepEqual(service.listStatusEvents(doctorA, id).map(({ status: value }) => value), ["SUSPENDED", "CANCELLED"]);
  await assert.rejects(() => service.transitionStatus(doctorA, status(id, doctorA.subjectId, 3, "SUSPENDED")), errorCode("CONFLICT"));
  await assert.rejects(() => service.changeClinicalContent(doctorA, change(id, doctorA.subjectId, 3)), errorCode("CONFLICT"));
});

test("prepared persistence failure leaves the review session active and retryable", async () => {
  let fail = true;
  const boundary = Object.freeze({
    synchronous: true,
    confirmAtomically({ prepare }) {
      const prepared = prepare();
      if (fail) {
        fail = false;
        throw new Error("synthetic persistence failure before commit");
      }
      const outcome = prepared.commit();
      return outcome;
    },
  });
  const { service, doctorA } = await fixture({ confirmationBoundary: boundary });
  const command = confirmation(doctorA.subjectId);
  await assert.rejects(() => service.confirm(doctorA, command), /synthetic persistence failure/);
  const retry = await service.confirm(doctorA, command);
  assert.equal(retry.prescription.currentPrescriptionVersion, 1);
  assert.equal(service.listPrescriptions(doctorA).length, 1);
});

test("malformed clock and generated identifiers fail before session consumption", async () => {
  let clockCalls = 0;
  const clock = () => (++clockCalls === 1 ? Number.NaN : Date.parse("2026-11-07T14:00:00Z"));
  const createId = (kind) => kind === "audit" ? "bad" : `${kind}_01JBR4N9V2Q8K6M3F7X5T1C0AZ`;
  const { service, doctorA } = await fixture({ clock, createId });
  const command = confirmation(doctorA.subjectId);
  await assert.rejects(() => service.confirm(doctorA, command), /Clock must return/);
  await assert.rejects(() => service.confirm(doctorA, command), /Generated identifiers/);
  assert.deepEqual(service.listPrescriptions(doctorA), []);
});

test("duplicate generated identifiers and audit linkage are rejected before commit", async () => {
  const duplicate = () => "dup_01JBR4N9V2Q8K6M3F7X5T1C0AZ";
  const { service, doctorA } = await fixture({ createId: duplicate });
  await assert.rejects(() => service.confirm(doctorA, confirmation(doctorA.subjectId)), errorCode("CONFLICT"));
  assert.deepEqual(service.listPrescriptions(doctorA), []);

  const valid = await fixture();
  const result = await valid.service.confirm(valid.doctorA, confirmation(valid.doctorA.subjectId));
  assert.equal(result.audit.prescriptionId, result.prescription.prescriptionId);
  assert.equal(result.audit.prescriptionVersion, result.version.prescriptionVersion);
  assert.equal(result.audit.resourceVersion, result.prescription.resourceVersion);
});

test("concurrent different-key confirmation attempts consume one session exactly once", async () => {
  const { service, doctorA } = await fixture();
  const first = confirmation(doctorA.subjectId, { idempotencyKey: "idem_confirmation_first_0001" });
  const second = confirmation(doctorA.subjectId, { idempotencyKey: "idem_confirmation_second_0002", correctedClinicalContent: CONTENT_2 });
  const outcomes = await Promise.allSettled([service.confirm(doctorA, first), service.confirm(doctorA, second)]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(service.listPrescriptions(doctorA).length, 1);
});
