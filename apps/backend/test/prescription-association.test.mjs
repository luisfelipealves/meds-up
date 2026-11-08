import assert from "node:assert/strict";
import test from "node:test";
import { ERROR_CODES } from "@medsup/contracts";
import {
  createInMemoryPrescriptionAssociationRepository,
  createPrescriptionAssociationService,
} from "../src/claims/prescription-association.mjs";
import {
  CLAIM_TOKEN_TTL_MS,
  createClaimTokenService,
  createInMemoryClaimTokenRepository,
} from "../src/claims/claim-token-lifecycle.mjs";
import {
  createClaimIdentityConfirmationService,
  createInMemoryClaimIdentityRepository,
} from "../src/claims/masked-identity-confirmation.mjs";
import { createDeterministicIdentityHarness, TEST_IDENTITIES } from "./support/deterministic-identity-harness.mjs";

const NOW = Date.UTC(2026, 10, 8, 12);

async function harness({ associationRepositoryOptions, associationClock, now = NOW } = {}) {
  let currentTime = now;
  const identity = createDeterministicIdentityHarness(TEST_IDENTITIES);
  const doctor = await identity.authenticate(TEST_IDENTITIES.DOCTOR.credential);
  const patient = await identity.authenticate(TEST_IDENTITIES.PATIENT.credential);
  let id = 0;
  const createId = (prefix) => `${prefix}_${String(++id).padStart(20, "0")}`;
  const tokenRepository = createInMemoryClaimTokenRepository();
  const tokenService = createClaimTokenService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    authorizePrescriptionOwnership: (subject, prescriptionId) => subject.subjectId === doctor.subjectId && prescriptionId === "prescription-0001",
    repository: tokenRepository,
    clock: () => currentTime,
    createId,
  });
  const issued = await tokenService.issue(doctor, { prescriptionId: "prescription-0001" });
  const identityService = createClaimIdentityConfirmationService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    claimTokenLifecycle: tokenService,
    repository: createInMemoryClaimIdentityRepository({ projections: [{
      claimTokenId: issued.claimTokenId,
      prescriptionId: "prescription-0001",
      initials: "AS",
      issuerDisplayName: "Clinica Sintetica",
      dateOfBirth: "1985-04-12",
    }] }),
    clock: () => currentTime,
    createId,
    isAllowedIssuerDisplayName: (value) => value === "Clinica Sintetica",
  });
  const associationRepository = createInMemoryPrescriptionAssociationRepository(associationRepositoryOptions);
  const associationService = createPrescriptionAssociationService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    claimIdentityConfirmation: identityService,
    repository: associationRepository,
    clock: associationClock ?? (() => currentTime),
    createId,
  });
  return {
    identity,
    doctor,
    patient,
    issued,
    tokenService,
    identityService,
    associationService,
    associationRepository,
    tokenRepository,
    createId,
    advance(milliseconds) { currentTime += milliseconds; },
  };
}

test("confirmed claim atomically creates one patient-prescription association and consumes its token", async () => {
  const h = await harness();
  const capability = h.identityService.confirm(h.patient, {
    rawToken: h.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  });

  const result = await h.associationService.associateConfirmed(h.patient, capability);

  assert.equal(result.association.prescriptionId, "prescription-0001");
  assert.equal(result.association.patientSubjectId, h.patient.subjectId);
  assert.equal(result.audit.eventType, "CLAIMED_PRESCRIPTION_ASSOCIATED");
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "CONSUMED");
  assert.equal(h.associationRepository.inspectForTests().associations.length, 1);
});

test("association and token consumption share one transaction timestamp", async () => {
  const h = await harness({ associationClock: () => NOW + 60_000 });
  const capability = h.identityService.confirm(h.patient, {
    rawToken: h.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  });

  const result = await h.associationService.associateConfirmed(h.patient, capability);
  const token = h.tokenRepository.inspectForTests().tokens[0];

  assert.equal(result.association.associatedAt, token.consumedAt);
  assert.equal(result.audit.occurredAt, token.consumedAt);
});

test("retrying the same confirmed handoff returns the original idempotent outcome without duplicates", async () => {
  const h = await harness();
  const capability = h.identityService.confirm(h.patient, {
    rawToken: h.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  });

  const first = await h.associationService.associateConfirmed(h.patient, capability);
  const replay = await h.associationService.associateConfirmed(h.patient, capability);

  assert.deepEqual(replay, first);
  assert.equal(h.associationRepository.inspectForTests().associations.length, 1);
  assert.equal(h.associationRepository.inspectForTests().audits.length, 1);
  assert.equal(h.tokenRepository.inspectForTests().attempts.filter(({ outcome }) => outcome === "CONSUMED").length, 1);
});

test("a later token cannot associate the same prescription again or expose association state", async () => {
  const h = await harness();
  const firstCapability = h.identityService.confirm(h.patient, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" });
  await h.associationService.associateConfirmed(h.patient, firstCapability);
  const second = await h.tokenService.issue(h.doctor, { prescriptionId: "prescription-0001" });
  const secondIdentity = createClaimIdentityConfirmationService({
    assertAuthenticatedSubject: h.identity.assertAuthenticatedSubject,
    claimTokenLifecycle: h.tokenService,
    repository: createInMemoryClaimIdentityRepository({ projections: [{
      claimTokenId: second.claimTokenId,
      prescriptionId: "prescription-0001",
      initials: "AS",
      issuerDisplayName: "Clinica Sintetica",
      dateOfBirth: "1985-04-12",
    }] }),
    clock: () => NOW,
    createId: h.createId,
    isAllowedIssuerDisplayName: () => true,
  });
  const secondAssociation = createPrescriptionAssociationService({
    assertAuthenticatedSubject: h.identity.assertAuthenticatedSubject,
    claimIdentityConfirmation: secondIdentity,
    repository: h.associationRepository,
    clock: () => NOW,
    createId: h.createId,
  });
  const secondCapability = secondIdentity.confirm(h.patient, { rawToken: second.qrPayload, dateOfBirth: "1985-04-12" });

  await assert.rejects(
    secondAssociation.associateConfirmed(h.patient, secondCapability),
    (error) => error.code === ERROR_CODES.CLAIM_IDENTITY_FAILED && !/prescription|association/i.test(error.message),
  );
  assert.equal(h.associationRepository.inspectForTests().associations.length, 1);
  assert.equal(h.tokenRepository.inspectForTests().tokens.find(({ claimTokenId }) => claimTokenId === second.claimTokenId).status, "ACTIVE");
});

test("concurrent confirmed completions create at most one association", async () => {
  const h = await harness();
  const capabilities = [1, 2].map(() => h.identityService.confirm(h.patient, {
    rawToken: h.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  }));

  const outcomes = await Promise.allSettled(capabilities.map((capability) =>
    h.associationService.associateConfirmed(h.patient, capability)));

  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(outcomes.find(({ status }) => status === "rejected").reason.code, ERROR_CODES.CLAIM_IDENTITY_FAILED);
  assert.equal(h.associationRepository.inspectForTests().associations.length, 1);
  assert.equal(h.associationRepository.inspectForTests().audits.length, 1);
});

test("association commit failure rolls back token, association and audits so the same handoff can retry", async () => {
  let fail = true;
  const h = await harness({ associationRepositoryOptions: {
    beforeCommit() {
      if (fail) {
        fail = false;
        throw new Error("synthetic association commit failure");
      }
    },
  } });
  const capability = h.identityService.confirm(h.patient, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" });

  await assert.rejects(h.associationService.associateConfirmed(h.patient, capability),
    (error) => error.code === ERROR_CODES.CLAIM_IDENTITY_FAILED);
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "ACTIVE");
  assert.equal(h.tokenRepository.inspectForTests().attempts.length, 0);
  assert.deepEqual(h.associationRepository.inspectForTests(), { associations: [], audits: [] });

  const retried = await h.associationService.associateConfirmed(h.patient, capability);
  assert.equal(retried.association.prescriptionId, "prescription-0001");
  assert.equal(h.tokenRepository.inspectForTests().tokens[0].status, "CONSUMED");
  assert.equal(h.associationRepository.inspectForTests().associations.length, 1);
});

test("confirmed handoffs cannot associate after exact expiry or revocation", async () => {
  const expired = await harness();
  const expiredCapability = expired.identityService.confirm(expired.patient, {
    rawToken: expired.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  });
  expired.advance(CLAIM_TOKEN_TTL_MS);
  await assert.rejects(expired.associationService.associateConfirmed(expired.patient, expiredCapability),
    (error) => error.code === ERROR_CODES.CLAIM_IDENTITY_FAILED);
  assert.equal(expired.associationRepository.inspectForTests().associations.length, 0);

  const revoked = await harness();
  const revokedCapability = revoked.identityService.confirm(revoked.patient, {
    rawToken: revoked.issued.qrPayload,
    dateOfBirth: "1985-04-12",
  });
  await revoked.tokenService.revoke(revoked.doctor, { claimTokenId: revoked.issued.claimTokenId });
  await assert.rejects(revoked.associationService.associateConfirmed(revoked.patient, revokedCapability),
    (error) => error.code === ERROR_CODES.CLAIM_IDENTITY_FAILED);
  assert.equal(revoked.associationRepository.inspectForTests().associations.length, 0);
});

test("one authenticated patient accumulates isolated prescriptions from multiple doctors", async () => {
  const OTHER_DOCTOR = Object.freeze({
    subjectId: "test-doctor-0002",
    role: "doctor",
    credential: Object.freeze({ login: "doctor-two@example.invalid", secret: "synthetic-doctor-two-secret" }),
  });
  const identity = createDeterministicIdentityHarness({ ...TEST_IDENTITIES, OTHER_DOCTOR });
  const doctorOne = await identity.authenticate(TEST_IDENTITIES.DOCTOR.credential);
  const doctorTwo = await identity.authenticate(OTHER_DOCTOR.credential);
  const patient = await identity.authenticate(TEST_IDENTITIES.PATIENT.credential);
  const owners = new Map([
    ["prescription-0001", doctorOne.subjectId],
    ["prescription-0002", doctorTwo.subjectId],
  ]);
  let id = 0;
  const createId = (prefix) => `${prefix}_${String(++id).padStart(20, "0")}`;
  const tokenRepository = createInMemoryClaimTokenRepository();
  const tokenService = createClaimTokenService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    authorizePrescriptionOwnership: (subject, prescriptionId) => owners.get(prescriptionId) === subject.subjectId,
    repository: tokenRepository,
    clock: () => NOW,
    createId,
  });
  const issuedOne = await tokenService.issue(doctorOne, { prescriptionId: "prescription-0001" });
  const issuedTwo = await tokenService.issue(doctorTwo, { prescriptionId: "prescription-0002" });
  const identityService = createClaimIdentityConfirmationService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    claimTokenLifecycle: tokenService,
    repository: createInMemoryClaimIdentityRepository({ projections: [issuedOne, issuedTwo].map((issued, index) => ({
      claimTokenId: issued.claimTokenId,
      prescriptionId: `prescription-000${index + 1}`,
      initials: "AS",
      issuerDisplayName: `Clinica Sintetica ${index + 1}`,
      dateOfBirth: "1985-04-12",
    })) }),
    clock: () => NOW,
    createId,
    isAllowedIssuerDisplayName: (value) => value.startsWith("Clinica Sintetica"),
  });
  const repository = createInMemoryPrescriptionAssociationRepository();
  const service = createPrescriptionAssociationService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    claimIdentityConfirmation: identityService,
    repository,
    clock: () => NOW,
    createId,
  });

  for (const issued of [issuedOne, issuedTwo]) {
    const capability = identityService.confirm(patient, { rawToken: issued.qrPayload, dateOfBirth: "1985-04-12" });
    await service.associateConfirmed(patient, capability);
  }

  const accumulated = service.listForPatient(patient);
  assert.deepEqual(accumulated.map(({ prescriptionId }) => prescriptionId).sort(), ["prescription-0001", "prescription-0002"]);
  assert.deepEqual(new Set(accumulated.map(({ ownerDoctorId }) => ownerDoctorId)), new Set([doctorOne.subjectId, doctorTwo.subjectId]));
  assert.equal(repository.inspectForTests().audits.length, 2);
});

test("only the trusted patient subject can continue either new-account or existing-account claim paths", async () => {
  for (const continuation of ["NEW_ACCOUNT", "EXISTING_ACCOUNT"]) {
    const h = await harness();
    const capability = h.identityService.confirm(h.patient, { rawToken: h.issued.qrPayload, dateOfBirth: "1985-04-12" });
    const result = await h.associationService.associateConfirmed(h.patient, capability);
    assert.equal(result.association.patientSubjectId, h.patient.subjectId, continuation);
    assert.throws(() => h.associationService.listForPatient(h.doctor), /role|permitted/i);
    assert.throws(() => h.associationService.listForPatient({ subjectId: h.patient.subjectId, role: "patient" }), /authenticated|invalid/i);
  }
});
