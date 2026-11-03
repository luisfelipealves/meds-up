import assert from "node:assert/strict";
import test from "node:test";

import {
  ERROR_CODES as CONTRACT_ERROR_CODES,
  ROLES as CONTRACT_ROLES,
  validateErrorEnvelope,
} from "@medsup/contracts";

import {
  ROLES,
  createAuthenticatedSubject,
  requireRole,
} from "../src/identity/subject.mjs";
import { ERROR_CODES, toErrorEnvelope } from "../src/identity/errors.mjs";
import {
  SAFE_TEST_IDENTITIES,
  createDeterministicFakeIdentityProvider,
} from "../src/identity/fake-identity-provider.mjs";
import { authenticateSubject } from "../src/identity/identity-port.mjs";
import { createSessionManager } from "../src/identity/session-manager.mjs";
import { createStructuredLogger } from "../src/observability/structured-logger.mjs";

test("doctor and patient subjects are explicit and non-interchangeable", () => {
  assert.equal(ROLES, CONTRACT_ROLES);
  assert.equal(ERROR_CODES, CONTRACT_ERROR_CODES);
  const doctor = createAuthenticatedSubject({ subjectId: "subject-doctor", role: ROLES.DOCTOR });
  const patient = createAuthenticatedSubject({ subjectId: "subject-patient", role: ROLES.PATIENT });

  assert.equal(requireRole(doctor, ROLES.DOCTOR), doctor);
  assert.equal(requireRole(patient, ROLES.PATIENT), patient);
  assert.throws(() => requireRole(doctor, ROLES.PATIENT), { code: "ROLE_FORBIDDEN" });
  assert.throws(() => requireRole(patient, ROLES.DOCTOR), { code: "ROLE_FORBIDDEN" });
  assert.throws(
    () => requireRole({ subjectId: "forged", role: ROLES.DOCTOR }, ROLES.DOCTOR),
    { code: "INVALID_AUTHENTICATED_SUBJECT" },
  );
});

test("foundation failures use the shared provider-neutral error envelope", () => {
  let failure;
  try {
    requireRole(createAuthenticatedSubject({ subjectId: "subject-doctor", role: ROLES.DOCTOR }), ROLES.PATIENT);
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

test("sessions authenticate until their configured expiry", () => {
  let now = Date.parse("2026-11-03T12:00:00Z");
  const sessions = createSessionManager({
    clock: () => now,
    sessionTtlMs: 60_000,
    tokenFactory: () => "opaque-session-token-1",
  });
  const subject = createAuthenticatedSubject({ subjectId: "subject-patient", role: ROLES.PATIENT });
  const session = sessions.establishSession(subject, "device-a");

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
    () => sessions.establishSession({ subjectId: "forged", role: ROLES.DOCTOR }, "device-a"),
    { code: "INVALID_AUTHENTICATED_SUBJECT" },
  );
});

test("all-session revocation invalidates every session and device in one transition", () => {
  const tokens = ["opaque-session-token-a", "opaque-session-token-b"];
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => tokens.shift(),
  });
  const patient = createAuthenticatedSubject({ subjectId: "subject-patient", role: ROLES.PATIENT });
  const first = sessions.establishSession(patient, "device-a");
  const second = sessions.establishSession(patient, "device-b");

  assert.deepEqual(sessions.revokeAll("subject-patient"), {
    subjectId: "subject-patient",
    revocationVersion: 1,
    sessionsRevoked: 2,
    devicesRevoked: 2,
  });
  assert.throws(() => sessions.authenticate(first.token), { code: "SESSION_REVOKED" });
  assert.throws(() => sessions.authenticate(second.token), { code: "SESSION_REVOKED" });
});

test("a revoked device is rejected when it later attempts synchronization", () => {
  const sessions = createSessionManager({
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
    sessionTtlMs: 60_000,
    tokenFactory: () => "opaque-session-token-a",
  });
  const patient = createAuthenticatedSubject({ subjectId: "subject-patient", role: ROLES.PATIENT });
  const session = sessions.establishSession(patient, "lost-device");

  assert.equal(sessions.authorizeSynchronization(session.token, "lost-device"), patient);
  sessions.revokeAll(patient.subjectId);
  assert.throws(
    () => sessions.authorizeSynchronization(session.token, "lost-device"),
    { code: "DEVICE_REVOKED" },
  );
});

test("structured logs allow-list operational fields and exclude sensitive values", () => {
  const entries = [];
  const logger = createStructuredLogger({
    sink: (entry) => entries.push(entry),
    clock: () => Date.parse("2026-11-03T12:00:00Z"),
  });

  logger.log("identity.authentication.failed", {
    requestId: "request-123",
    action: "authenticate",
    outcome: "rejected",
    errorCode: "AUTHENTICATION_FAILED",
    credential: "credential-value-must-not-appear",
    token: "token-value-must-not-appear",
    identity: { email: "patient@example.invalid" },
    prescription: { medication: "clinical-value-must-not-appear" },
  });

  assert.deepEqual(entries, [{
    timestamp: "2026-11-03T12:00:00.000Z",
    event: "identity.authentication.failed",
    requestId: "request-123",
    action: "authenticate",
    outcome: "rejected",
    errorCode: "AUTHENTICATION_FAILED",
  }]);
  const serialized = JSON.stringify(entries);
  for (const sensitive of ["credential-value", "token-value", "patient@example", "clinical-value"]) {
    assert.doesNotMatch(serialized, new RegExp(sensitive));
  }
});
