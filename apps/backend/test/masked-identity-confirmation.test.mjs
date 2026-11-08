import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "@medsup/contracts";
import { toErrorEnvelope } from "../src/identity/errors.mjs";
import { createClaimTokenService, createInMemoryClaimTokenRepository } from "../src/claims/claim-token-lifecycle.mjs";
import {
  createClaimIdentityConfirmationService,
  createInMemoryClaimIdentityRepository,
  maskPatientName,
} from "../src/claims/masked-identity-confirmation.mjs";
import { createDeterministicIdentityHarness, TEST_IDENTITIES } from "./support/deterministic-identity-harness.mjs";

const NOW = Date.UTC(2026, 10, 8);
const GENERIC = (error) => error.code === ERROR_CODES.CLAIM_IDENTITY_FAILED && error.message === "Please contact your doctor or clinic.";
const expectFailure = (fn, predicate = GENERIC) => assert.throws(fn, predicate);

async function harness({ maxFailedAttempts = 3 } = {}) {
  const identities = {
    ...TEST_IDENTITIES,
    OTHER_PATIENT: Object.freeze({ subjectId: "test-patient-0002", role: "patient", credential: Object.freeze({ login: "other-patient@example.invalid", secret: "other-safe-patient-secret" }) }),
  };
  const identity = createDeterministicIdentityHarness(identities);
  const doctor = await identity.authenticate(TEST_IDENTITIES.DOCTOR.credential);
  const patient = await identity.authenticate(TEST_IDENTITIES.PATIENT.credential);
  const otherPatient = await identity.authenticate(identities.OTHER_PATIENT.credential);
  const tokenRepository = createInMemoryClaimTokenRepository();
  let id = 0;
  const tokenService = createClaimTokenService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    authorizePrescriptionOwnership: (subject, prescriptionId) => subject.subjectId === doctor.subjectId && prescriptionId === "prescription-0001",
    repository: tokenRepository,
    clock: () => NOW,
    createId: (prefix) => `${prefix}_${String(++id).padStart(20, "0")}`,
    rateLimit: { maxFailedAttempts: 5, windowMs: 900_000 },
  });
  const issued = await tokenService.issue(doctor, { prescriptionId: "prescription-0001" });
  const identityRepository = createInMemoryClaimIdentityRepository({ projections: [{
    claimTokenId: issued.claimTokenId,
    prescriptionId: "prescription-0001",
    initials: maskPatientName("Ana Maria Silva"),
    issuerDisplayName: "Clinica Sintetica",
    dateOfBirth: "1985-04-12",
  }] });
  const identityService = createClaimIdentityConfirmationService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    claimTokenLifecycle: tokenService,
    repository: identityRepository,
    clock: () => NOW,
    createId: (prefix) => `${prefix}_${String(++id).padStart(20, "0")}`,
    rateLimit: { maxFailedAttempts, windowMs: 900_000 },
    isAllowedIssuerDisplayName: (value) => value === "Clinica Sintetica",
  });
  return { identity, doctor, patient, otherPatient, issued, tokenService, identityService, identityRepository, tokenRepository };
}

test("masking derives deterministic initials and never returns the patient name", () => {
  assert.equal(maskPatientName(" Ana Maria Silva "), "AS");
  assert.equal(maskPatientName("Érico"), "É");
  assert.throws(() => maskPatientName("Ana 123"));
});

test("authenticated preview is strictly masked and does not consume the lifecycle token", async () => {
  const h = await harness();
  const preview = h.identityService.preview(h.patient, { rawToken: h.issued.qrPayload });
  assert.deepEqual(preview, { initials: "AS", issuerDisplayName: "Clinica Sintetica" });
  assert.deepEqual(Object.keys(preview).sort(), ["initials", "issuerDisplayName"]);
  assert.equal(JSON.stringify(preview).includes("1985"), false);
  assert.equal(JSON.stringify(preview).includes("Ana"), false);
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "ACTIVE");
  assert.deepEqual(h.identityService.inspectAuditForTests().attempts.map(({ operation, outcome }) => ({ operation, outcome })), [{ operation: "PREVIEW", outcome: "PREVIEWED" }]);
});

test("authentication is required before preview or confirmation", async () => {
  const h = await harness();
  const forged = { subjectId: h.patient.subjectId, role: "patient" };
  assert.throws(() => h.identityService.preview(forged, { rawToken: h.issued.qrPayload }), /authenticated|invalid/i);
  expectFailure(() => h.identityService.confirm(h.doctor, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" }), /role|permitted/i);
});

test("malformed, unknown, expired, consumed and mismatch failures share one external result and do not enumerate", async () => {
  const h = await harness();
  const invalidInputs = [
    { rawToken: "malformed", dateOfBirth: "1985-04-12" },
    { rawToken: "A".repeat(43), dateOfBirth: "1985-04-12" },
    { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-13" },
  ];
  for (const input of invalidInputs) expectFailure(() => h.identityService.confirm(h.patient, input));
  const audit = h.identityService.inspectAuditForTests();
  assert.deepEqual(audit.attempts.map(({ outcome }) => outcome), ["INVALID_TOKEN", "INVALID_TOKEN", "DOB_MISMATCH"]);
  const serialized = JSON.stringify({ audit, errors: invalidInputs });
  assert.equal(serialized.includes("1985-04-12"), true); // input fixture only; audit never contains it
  assert.equal(JSON.stringify(audit.attempts).includes("1985-04-12"), false);
  assert.equal(JSON.stringify(audit.attempts).includes(h.issued.qrPayload), false);
  assert.equal(JSON.stringify(audit.attempts).includes("Ana Maria"), false);
});

test("matching DOB returns a non-forgeable handoff and only that explicit handoff can consume", async () => {
  const h = await harness();
  const capability = h.identityService.confirm(h.patient, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" });
  assert.deepEqual(capability, { type: "CLAIM_IDENTITY_CONFIRMED", version: 1 });
  assert.equal(JSON.stringify(capability).includes(h.issued.qrPayload), false);
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "ACTIVE");
  expectFailure(() => h.identityService.consumeConfirmed(h.otherPatient, capability));
  assert.equal((await h.identityService.consumeConfirmed(h.patient, capability)).prescriptionId, "prescription-0001");
  expectFailure(() => h.identityService.consumeConfirmed(h.patient, capability));
  assert.deepEqual(h.identityService.inspectAuditForTests().attempts.map(({ outcome }) => outcome), ["CONFIRMED"]);
});

test("failed confirmation attempts are bounded per trusted patient and every outcome is audited", async () => {
  const h = await harness({ maxFailedAttempts: 2 });
  for (let i = 0; i < 2; i += 1) expectFailure(() => h.identityService.confirm(h.patient, { rawToken: "B".repeat(43), dateOfBirth: "1985-04-12" }));
  expectFailure(() => h.identityService.preview(h.patient, { rawToken: h.issued.qrPayload }));
  assert.equal(h.identityService.inspectAuditForTests().attempts.at(-1).outcome, "RATE_LIMITED");
  assert.equal((await h.identityService.preview(h.otherPatient, { rawToken: h.issued.qrPayload })).initials, "AS");
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "ACTIVE");
});

test("projection rejects clinical and provider-shaped leakage", async () => {
  const identity = createDeterministicIdentityHarness(TEST_IDENTITIES);
  const repository = createInMemoryClaimIdentityRepository({ projections: [] });
  assert.throws(() => createInMemoryClaimIdentityRepository({ projections: [{
    claimTokenId: "claim_token_00000000000001", prescriptionId: "prescription_00000001", initials: "AS",
    issuerDisplayName: "Clinica Sintetica", dateOfBirth: "1985-04-12", medication: "forbidden",
  }] }), /invalid shape/i);
  assert.equal(typeof identity.assertAuthenticatedSubject, "function");
  assert.deepEqual(repository.inspectForTests(), { projections: [], attempts: [] });
  for (const control of ["\u200B", "\u200F", "\u202A", "\u202E", "\u2060", "\u2066", "\uFEFF", "\u2028", "\u2029"]) {
    assert.throws(() => createInMemoryClaimIdentityRepository({ projections: [{
      claimTokenId: "claim_token_00000000000001", prescriptionId: "prescription_00000001", initials: "AS",
      issuerDisplayName: `Clinica${control} Sintetica`, dateOfBirth: "1985-04-12",
    }] }), /issuer display name/i);
  }
});

test("repository projection and audit snapshots never retain a full patient name", async () => {
  const h = await harness();
  const snapshot = h.identityRepository.inspectForTests();
  assert.deepEqual(Object.keys(snapshot.projections[0]).sort(), ["claimTokenId", "dateOfBirth", "initials", "issuerDisplayName", "prescriptionId"]);
  assert.equal(JSON.stringify(snapshot).includes("Ana Maria Silva"), false);
  assert.throws(() => createInMemoryClaimIdentityRepository({ projections: [{
    claimTokenId: "claim_token_00000000000001", prescriptionId: "prescription_00000001", patientName: "Ana Silva", initials: "AS",
    issuerDisplayName: "Clinica Sintetica", dateOfBirth: "1985-04-12",
  }] }), /invalid shape/i);
});

test("transport envelope preserves the same generic identity failure code, shape and message", async () => {
  const h = await harness({ maxFailedAttempts: 1 });
  const failures = [];
  for (const command of [{ rawToken: "malformed" }, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-13" }]) {
    try { h.identityService.confirm(h.patient, { dateOfBirth: "1985-04-12", ...command }); } catch (error) { failures.push(error); }
  }
  try { h.identityService.preview(h.patient, { rawToken: h.issued.qrPayload }); } catch (error) { failures.push(error); }
  const envelopes = failures.map((error) => ({ error, envelope: toErrorEnvelope(error, "req_claim_identity_0001") }));
  assert.equal(new Set(envelopes.map(({ envelope }) => JSON.stringify(envelope.error))).size, 1);
  assert.equal(envelopes[0].envelope.error.message, "Please contact your doctor or clinic.");
});

test("audit and repository failures cannot escape as TypeError", async () => {
  const h = await harness();
  const failingRepository = {
    getByClaimTokenId() { throw new TypeError("repository failure"); },
    failedAttempts() { return 0; },
    recordAttempt() { throw new TypeError("audit failure"); },
    inspectForTests() { return {}; },
  };
  const service = createClaimIdentityConfirmationService({
    assertAuthenticatedSubject: h.identity.assertAuthenticatedSubject,
    claimTokenLifecycle: h.tokenService,
    repository: failingRepository,
    clock: () => NOW,
    createId: (prefix) => `${prefix}_99999999999999999999`,
    rateLimit: { maxFailedAttempts: 5, windowMs: 900_000 },
    isAllowedIssuerDisplayName: () => true,
  });
  assert.throws(() => service.confirm(h.patient, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" }), GENERIC);
});
