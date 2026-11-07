import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ERROR_CODES } from "@medsup/contracts";
import {
  CLAIM_TOKEN_TTL_MS,
  createClaimTokenService,
  createInMemoryClaimTokenRepository,
} from "../src/claims/claim-token-lifecycle.mjs";
import {
  createDeterministicIdentityHarness,
  TEST_IDENTITIES,
} from "./support/deterministic-identity-harness.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

async function harness({ now = Date.UTC(2026, 10, 7), maxFailedAttempts = 5, repositoryOptions, clock } = {}) {
  let currentTime = now;
  const identities = {
    ...TEST_IDENTITIES,
    OTHER_DOCTOR: Object.freeze({
      subjectId: "test-doctor-0002",
      role: "doctor",
      credential: Object.freeze({ login: "other-doctor@example.invalid", secret: "other-safe-secret" }),
    }),
    OTHER_PATIENT: Object.freeze({
      subjectId: "test-patient-0002",
      role: "patient",
      credential: Object.freeze({ login: "other-patient@example.invalid", secret: "other-patient-safe-secret" }),
    }),
  };
  const identity = createDeterministicIdentityHarness(identities);
  const doctor = await identity.authenticate(identities.DOCTOR.credential);
  const otherDoctor = await identity.authenticate(identities.OTHER_DOCTOR.credential);
  const patient = await identity.authenticate(identities.PATIENT.credential);
  const otherPatient = await identity.authenticate(identities.OTHER_PATIENT.credential);
  const owners = new Map([
    ["prescription-0001", doctor.subjectId],
    ["prescription-0002", doctor.subjectId],
    ["prescription-other", otherDoctor.subjectId],
  ]);
  const repository = createInMemoryClaimTokenRepository(repositoryOptions);
  let identifier = 0;
  const service = createClaimTokenService({
    assertAuthenticatedSubject: identity.assertAuthenticatedSubject,
    authorizePrescriptionOwnership(subject, prescriptionId) {
      if (owners.get(prescriptionId) !== subject.subjectId) return false;
      return true;
    },
    repository,
    clock: clock ?? (() => currentTime),
    createId: (prefix) => `${prefix}_${String(++identifier).padStart(20, "0")}`,
    rateLimit: { maxFailedAttempts, windowMs: 15 * 60 * 1000 },
  });
  return {
    service,
    repository,
    doctor,
    otherDoctor,
    patient,
    otherPatient,
    now: () => currentTime,
    advance: (milliseconds) => { currentTime += milliseconds; },
  };
}

function expectGenericClaimFailure(error) {
  assert.equal(error.code, ERROR_CODES.CONFLICT);
  assert.equal(error.message, "The claim could not be completed.");
  return true;
}

test("issues cryptographically random opaque tokens with digest-only storage and exact seven-day expiry", async () => {
  const h = await harness();
  const first = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  const second = await h.service.issue(h.doctor, { prescriptionId: "prescription-0002" });

  assert.match(first.qrPayload, /^[A-Za-z0-9_-]{43}$/);
  assert.match(second.qrPayload, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.qrPayload, second.qrPayload);
  assert.deepEqual(Object.keys(first).sort(), ["claimTokenId", "expiresAt", "qrPayload"].sort());
  assert.equal(Date.parse(first.expiresAt) - h.now(), CLAIM_TOKEN_TTL_MS);
  assert.equal(CLAIM_TOKEN_TTL_MS, 7 * DAY_MS);

  const stored = h.repository.inspectForTests();
  const serialized = JSON.stringify(stored);
  assert.equal(serialized.includes(first.qrPayload), false);
  assert.equal(serialized.includes(second.qrPayload), false);
  assert.equal(stored.tokens[0].tokenDigest, createHash("sha256").update(first.qrPayload, "utf8").digest("hex"));
  assert.equal("rawToken" in stored.tokens[0], false);
  assert.equal("qrPayload" in stored.tokens[0], false);
});

test("allows only the owning doctor to issue, revoke, replace, read, or list claim controls", async () => {
  const h = await harness();
  await assert.rejects(
    h.service.issue(h.doctor, { prescriptionId: "prescription-other" }),
    (error) => error.code === ERROR_CODES.NOT_FOUND,
  );
  const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  assert.throws(
    () => h.service.getControl(h.otherDoctor, issued.claimTokenId),
    (error) => error.code === ERROR_CODES.NOT_FOUND,
  );
  for (const operation of [
    () => h.service.revoke(h.otherDoctor, { claimTokenId: issued.claimTokenId }),
    () => h.service.replace(h.otherDoctor, { claimTokenId: issued.claimTokenId }),
  ]) {
    await assert.rejects(operation(), (error) => error.code === ERROR_CODES.NOT_FOUND);
  }
  assert.deepEqual(h.service.listControls(h.otherDoctor), []);
  const ownerView = h.service.getControl(h.doctor, issued.claimTokenId);
  assert.equal(ownerView.prescriptionId, "prescription-0001");
  assert.equal("tokenDigest" in ownerView, false);
  assert.equal(JSON.stringify(ownerView).includes(issued.qrPayload), false);
});

test("consumes once atomically and rejects replay including concurrent attempts", async () => {
  const h = await harness();
  const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  const outcomes = await Promise.allSettled([
    h.service.consume(h.patient, { rawToken: issued.qrPayload }),
    h.service.consume(h.otherPatient, { rawToken: issued.qrPayload }),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(outcomes.find(({ status }) => status === "rejected").reason.code, ERROR_CODES.CONFLICT);
  await assert.rejects(h.service.consume(h.patient, { rawToken: issued.qrPayload }), expectGenericClaimFailure);
  const stored = h.repository.inspectForTests();
  assert.equal(stored.tokens[0].status, "CONSUMED");
  assert.equal(stored.attempts.filter(({ outcome }) => outcome === "CONSUMED").length, 1);
  assert.equal(stored.attempts.filter(({ outcome }) => outcome === "ALREADY_CONSUMED").length, 2);
});

test("accepts before expiry and rejects exactly at and after seven days", async () => {
  const before = await harness();
  const valid = await before.service.issue(before.doctor, { prescriptionId: "prescription-0001" });
  before.advance(CLAIM_TOKEN_TTL_MS - 1);
  assert.equal((await before.service.consume(before.patient, { rawToken: valid.qrPayload })).prescriptionId, "prescription-0001");

  for (const delta of [CLAIM_TOKEN_TTL_MS, CLAIM_TOKEN_TTL_MS + 1]) {
    const h = await harness();
    const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
    h.advance(delta);
    await assert.rejects(h.service.consume(h.patient, { rawToken: issued.qrPayload }), expectGenericClaimFailure);
    assert.equal(h.repository.inspectForTests().attempts.at(-1).outcome, "EXPIRED");
  }
});

test("revocation and replacement invalidate old tokens while replacement returns one new opaque secret", async () => {
  const revokedHarness = await harness();
  const revoked = await revokedHarness.service.issue(revokedHarness.doctor, { prescriptionId: "prescription-0001" });
  await revokedHarness.service.revoke(revokedHarness.doctor, { claimTokenId: revoked.claimTokenId });
  await assert.rejects(revokedHarness.service.consume(revokedHarness.patient, { rawToken: revoked.qrPayload }), expectGenericClaimFailure);
  assert.equal(revokedHarness.repository.inspectForTests().attempts.at(-1).outcome, "REVOKED");

  const h = await harness();
  const original = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  const replacement = await h.service.replace(h.doctor, { claimTokenId: original.claimTokenId });
  assert.notEqual(replacement.qrPayload, original.qrPayload);
  assert.equal(Date.parse(replacement.expiresAt) - h.now(), CLAIM_TOKEN_TTL_MS);
  await assert.rejects(h.service.consume(h.patient, { rawToken: original.qrPayload }), expectGenericClaimFailure);
  assert.equal((await h.service.consume(h.patient, { rawToken: replacement.qrPayload })).prescriptionId, "prescription-0001");
  const tokens = h.repository.inspectForTests().tokens;
  assert.equal(tokens.find(({ claimTokenId }) => claimTokenId === original.claimTokenId).status, "REPLACED");
  assert.equal(tokens.find(({ claimTokenId }) => claimTokenId === replacement.claimTokenId).status, "CONSUMED");
});

test("anchors replacement expiry and replacedAt to one operation timestamp", async () => {
  const issuedAt = Date.UTC(2026, 10, 7);
  const replacementAt = issuedAt + 1234;
  const clockValues = [issuedAt, replacementAt];
  const h = await harness({ clock: () => clockValues.shift() });
  const original = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  const replacement = await h.service.replace(h.doctor, { claimTokenId: original.claimTokenId });
  const replacementRecord = h.repository.inspectForTests().tokens.find(
    ({ claimTokenId }) => claimTokenId === replacement.claimTokenId,
  );
  const replacedRecord = h.repository.inspectForTests().tokens.find(
    ({ claimTokenId }) => claimTokenId === original.claimTokenId,
  );

  assert.equal(Date.parse(replacement.expiresAt), replacementAt + CLAIM_TOKEN_TTL_MS);
  assert.equal(Date.parse(replacementRecord.issuedAt), replacementAt);
  assert.equal(Date.parse(replacedRecord.replacedAt), replacementAt);
  assert.equal(Date.parse(replacementRecord.expiresAt) - Date.parse(replacedRecord.replacedAt), CLAIM_TOKEN_TTL_MS);
  assert.equal(clockValues.length, 0);
});

test("audits success and every token failure without persisting raw tokens", async () => {
  const h = await harness();
  const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  for (const rawToken of ["malformed", "A".repeat(43)]) {
    await assert.rejects(h.service.consume(h.patient, { rawToken }), expectGenericClaimFailure);
  }
  await h.service.consume(h.patient, { rawToken: issued.qrPayload });
  const snapshot = h.repository.inspectForTests();
  assert.deepEqual(snapshot.attempts.map(({ outcome }) => outcome), ["INVALID_TOKEN", "INVALID_TOKEN", "CONSUMED"]);
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes(issued.qrPayload), false);
  assert.equal(serialized.includes("A".repeat(43)), false);
  assert.equal(snapshot.attempts.every((attempt) => !("rawToken" in attempt) && !("tokenDigest" in attempt)), true);
});

test("rate limits failed claims per trusted patient and resets at the exact window boundary", async () => {
  const h = await harness({ maxFailedAttempts: 2 });
  for (let index = 0; index < 2; index += 1) {
    await assert.rejects(h.service.consume(h.patient, { rawToken: "A".repeat(43) }), expectGenericClaimFailure);
  }
  const valid = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  await assert.rejects(h.service.consume(h.patient, { rawToken: valid.qrPayload }), expectGenericClaimFailure);
  assert.equal(h.repository.inspectForTests().attempts.at(-1).outcome, "RATE_LIMITED");
  assert.equal((await h.service.consume(h.otherPatient, { rawToken: valid.qrPayload })).prescriptionId, "prescription-0001");

  const boundary = await harness({ maxFailedAttempts: 1 });
  await assert.rejects(boundary.service.consume(boundary.patient, { rawToken: "B".repeat(43) }), expectGenericClaimFailure);
  boundary.advance(15 * 60 * 1000);
  const boundaryToken = await boundary.service.issue(boundary.doctor, { prescriptionId: "prescription-0001" });
  assert.equal((await boundary.service.consume(boundary.patient, { rawToken: boundaryToken.qrPayload })).prescriptionId, "prescription-0001");
});

test("transaction failure rolls back all state and a retry succeeds once", async () => {
  let failConsume = true;
  const h = await harness({
    repositoryOptions: {
      beforeCommit(operation) {
        if (operation === "CONSUME" && failConsume) {
          failConsume = false;
          throw new Error("synthetic commit fault");
        }
      },
    },
  });
  const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  await assert.rejects(h.service.consume(h.patient, { rawToken: issued.qrPayload }), /synthetic commit fault/);
  let snapshot = h.repository.inspectForTests();
  assert.equal(snapshot.tokens[0].status, "ACTIVE");
  assert.equal(snapshot.attempts.length, 0);
  assert.equal((await h.service.consume(h.patient, { rawToken: issued.qrPayload })).prescriptionId, "prescription-0001");
  snapshot = h.repository.inspectForTests();
  assert.equal(snapshot.tokens[0].status, "CONSUMED");
  assert.equal(snapshot.attempts.length, 1);
});

test("raw secrets do not leak through errors, owner projections, persistence, logs, telemetry fields, or URLs", async () => {
  const h = await harness();
  const issued = await h.service.issue(h.doctor, { prescriptionId: "prescription-0001" });
  await h.service.revoke(h.doctor, { claimTokenId: issued.claimTokenId });
  let captured;
  await assert.rejects(
    h.service.consume(h.patient, { rawToken: issued.qrPayload }),
    (error) => { captured = error; return true; },
  );
  const examined = JSON.stringify({
    error: { name: captured.name, code: captured.code, message: captured.message, stack: captured.stack },
    controls: h.service.listControls(h.doctor),
    persistence: h.repository.inspectForTests(),
  });
  assert.equal(examined.includes(issued.qrPayload), false);
  assert.equal(examined.includes("http://"), false);
  assert.equal(examined.includes("https://"), false);
  assert.equal(examined.includes("url"), false);
  assert.equal(h.repository.inspectForTests().attempts.every((attempt) => Object.keys(attempt).every((key) => !/log|telemetry|url|secret|raw/i.test(key))), true);
});
