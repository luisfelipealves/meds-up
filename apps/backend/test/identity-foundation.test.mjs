import assert from "node:assert/strict";
import test from "node:test";

import {
  ERROR_CODES as CONTRACT_ERROR_CODES,
  ROLES as CONTRACT_ROLES,
  validateErrorEnvelope,
} from "@medsup/contracts";

import {
  ROLES,
  requireRole,
} from "../src/identity/subject.mjs";
import * as subjectModule from "../src/identity/subject.mjs";
import { ERROR_CODES, toErrorEnvelope } from "../src/identity/errors.mjs";
import {
  SAFE_TEST_IDENTITIES,
  createDeterministicFakeIdentityProvider,
} from "../src/identity/fake-identity-provider.mjs";
import { authenticateSubject } from "../src/identity/identity-port.mjs";
import { createSessionManager } from "../src/identity/session-manager.mjs";
import { createStructuredLogger } from "../src/observability/structured-logger.mjs";

async function authenticateTestIdentity(identity) {
  return authenticateSubject(createDeterministicFakeIdentityProvider(), identity.credential);
}

test("ordinary application callers cannot mint authenticated subjects", async () => {
  assert.equal(Object.hasOwn(subjectModule, "createAuthenticatedSubject"), false);
  await assert.rejects(
    authenticateSubject({
      async authenticate() {
        return { subjectId: "attacker", role: ROLES.DOCTOR };
      },
    }, { credential: "attacker-controlled" }),
    { code: "AUTHENTICATION_FAILED" },
  );
});

test("doctor and patient subjects are explicit and non-interchangeable", async () => {
  assert.equal(ROLES, CONTRACT_ROLES);
  assert.equal(ERROR_CODES, CONTRACT_ERROR_CODES);
  const doctor = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.DOCTOR);
  const patient = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);

  assert.equal(requireRole(doctor, ROLES.DOCTOR), doctor);
  assert.equal(requireRole(patient, ROLES.PATIENT), patient);
  assert.throws(() => requireRole(doctor, ROLES.PATIENT), { code: "ROLE_FORBIDDEN" });
  assert.throws(() => requireRole(patient, ROLES.DOCTOR), { code: "ROLE_FORBIDDEN" });
  assert.throws(
    () => requireRole({ subjectId: "forged", role: ROLES.DOCTOR }, ROLES.DOCTOR),
    { code: "INVALID_AUTHENTICATED_SUBJECT" },
  );
});

test("foundation failures use the shared provider-neutral error envelope", async () => {
  let failure;
  try {
    requireRole(await authenticateTestIdentity(SAFE_TEST_IDENTITIES.DOCTOR), ROLES.PATIENT);
  } catch (error) {
    failure = error;
  }

  const envelope = toErrorEnvelope(failure, "req_identity_0001");
  assert.deepEqual(envelope, {
    apiVersion: "v1",
    error: {
      code: "ROLE_FORBIDDEN",
      message: "The authenticated role is not permitted.",
      requestId: "req_identity_0001",
      retryable: false,
    },
  });
  assert.equal(validateErrorEnvelope(envelope), envelope);
});

test("replaceable identity providers authenticate deterministic safe test identities", async () => {
  const provider = createDeterministicFakeIdentityProvider();
  const doctor = await authenticateSubject(provider, SAFE_TEST_IDENTITIES.DOCTOR.credential);
  const patient = await authenticateSubject(provider, SAFE_TEST_IDENTITIES.PATIENT.credential);

  assert.deepEqual(doctor, { subjectId: "test-doctor-0001", role: ROLES.DOCTOR });
  assert.deepEqual(patient, { subjectId: "test-patient-0001", role: ROLES.PATIENT });
  await assert.rejects(
    authenticateSubject(provider, { login: "nobody@example.invalid", secret: "not-a-real-secret" }),
    { code: "AUTHENTICATION_FAILED" },
  );
});

test("sessions authenticate until their configured expiry", async () => {
  let now = Date.parse("2026-11-03T12:00:00Z");
  const sessions = createSessionManager({
    clock: () => now,
    sessionTtlMs: 60_000,
    tokenFactory: () => "opaque-session-token-1",
  });
  const subject = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);
  const session = sessions.establishSession(subject, "device_01JBR7C4N8M2X5K9Q1T6V3AZ");

  assert.equal(session.expiresAt, "2026-11-03T12:01:00.000Z");
  assert.equal(sessions.authenticate(session.token), subject);

  now += 60_000;
  assert.throws(() => sessions.authenticate(session.token), { code: "SESSION_EXPIRED" });
});

test("sessions can only be established for authenticated subjects", () => {
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => "opaque-session-token-a",
  });

  assert.throws(
    () => sessions.establishSession({ subjectId: "forged", role: ROLES.DOCTOR }, "device_01JBR7C4N8M2X5K9Q1T6V3AZ"),
    { code: "INVALID_AUTHENTICATED_SUBJECT" },
  );
});

test("all-session revocation invalidates every session and device in one transition", async () => {
  const tokens = ["opaque-session-token-a", "opaque-session-token-b"];
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => tokens.shift(),
  });
  const patient = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);
  const first = sessions.establishSession(patient, "device_01JBR7C4N8M2X5K9Q1T6V3AZ");
  const second = sessions.establishSession(patient, "device_01JBR7D5N9M3X6K0Q2T7V4AZ");

  assert.deepEqual(sessions.revokeAll(patient.subjectId), {
    subjectId: patient.subjectId,
    revocationVersion: 1,
    sessionsRevoked: 2,
    devicesRevoked: 2,
  });
  assert.throws(() => sessions.authenticate(first.token), { code: "SESSION_REVOKED" });
  assert.throws(() => sessions.authenticate(second.token), { code: "SESSION_REVOKED" });
});

test("a revoked device is rejected when it later attempts synchronization", async () => {
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => "opaque-session-token-a",
  });
  const patient = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);
  const session = sessions.establishSession(patient, "device_01JBR7E6N0M4X7K1Q3T8V5AZ");

  assert.equal(sessions.authorizeSynchronization(session.token, "device_01JBR7E6N0M4X7K1Q3T8V5AZ"), patient);
  sessions.revokeAll(patient.subjectId);
  assert.throws(
    () => sessions.authorizeSynchronization(session.token, "device_01JBR7E6N0M4X7K1Q3T8V5AZ"),
    { code: "DEVICE_REVOKED" },
  );
});

test("revoked devices require explicit trusted replacement before a fresh session", async () => {
  const tokens = ["opaque-session-token-old", "opaque-session-token-fresh", "opaque-session-token-replacement"];
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => tokens.shift(),
  });
  const patient = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);
  const oldSession = sessions.establishSession(patient, "device_01JBR7E6N0M4X7K1Q3T8V5AZ");

  sessions.revokeAll(patient.subjectId);
  assert.throws(() => sessions.authenticate(oldSession.token), { code: "SESSION_REVOKED" });
  assert.throws(
    () => sessions.establishSession(patient, "device_01JBR7E6N0M4X7K1Q3T8V5AZ"),
    { code: "DEVICE_REVOKED" },
  );

  const replacement = sessions.replaceRevokedDevice(patient, "device_01JBR7E6N0M4X7K1Q3T8V5AZ");
  assert.equal(sessions.authorizeSynchronization(replacement.token, "device_01JBR7E6N0M4X7K1Q3T8V5AZ"), patient);
  assert.throws(() => sessions.authenticate(oldSession.token), { code: "SESSION_REVOKED" });
});

test("session establishment rejects invalid device IDs and duplicate generated tokens", async () => {
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => "duplicate-opaque-session-token",
  });
  const patient = await authenticateTestIdentity(SAFE_TEST_IDENTITIES.PATIENT);

  for (const invalidDeviceId of [null, "", "short", "device id with spaces", "d".repeat(129)]) {
    assert.throws(() => sessions.establishSession(patient, invalidDeviceId), TypeError);
  }

  sessions.establishSession(patient, "device_01JBR7C4N8M2X5K9Q1T6V3AZ");
  assert.throws(
    () => sessions.establishSession(patient, "device_01JBR7D5N9M3X6K0Q2T7V4AZ"),
    { code: "CONFLICT" },
  );
});

test("structured logs accept only bounded operational values", () => {
  const entries = [];
  const logger = createStructuredLogger({
    sink: (entry) => entries.push(entry),
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
  });

  logger.log("identity.authentication.failed", {
    requestId: "req_01JBR6V2N8M4X7K5T9Q1P3AZ",
    action: "AUTHENTICATE",
    outcome: "REJECTED",
    errorCode: "AUTHENTICATION_FAILED",
    durationMs: 12,
  });

  assert.deepEqual(entries, [{
    timestamp: "2026-11-03T12:00:00.000Z",
    event: "identity.authentication.failed",
    requestId: "req_01JBR6V2N8M4X7K5T9Q1P3AZ",
    action: "AUTHENTICATE",
    outcome: "REJECTED",
    errorCode: "AUTHENTICATION_FAILED",
    durationMs: 12,
  }]);
});

test("structured logging rejects sensitive values through every accepted input", () => {
  const entries = [];
  const logger = createStructuredLogger({ sink: (entry) => entries.push(entry) });
  const valid = {
    requestId: "req_01JBR6V2N8M4X7K5T9Q1P3AZ",
    action: "AUTHENTICATE",
    outcome: "REJECTED",
    errorCode: "AUTHENTICATION_FAILED",
    durationMs: 12,
  };
  const sensitive = "raw OCR patient medication dose credential identity unconfirmed proposal";

  assert.throws(() => logger.log(sensitive, valid), TypeError);
  for (const field of Object.keys(valid)) {
    assert.throws(() => logger.log("identity.authentication.failed", { ...valid, [field]: sensitive }), TypeError);
  }
  for (const field of ["document", "ocrText", "proposal", "identity", "credential", "clinicalContent"] ) {
    assert.throws(() => logger.log("identity.authentication.failed", { ...valid, [field]: sensitive }), TypeError);
  }
  assert.deepEqual(entries, []);
});
