import { ERROR_CODES, FoundationError } from "./errors.mjs";

export function createSessionManager({
  assertAuthenticatedSubject,
  clock = Date.now,
  sessionTtlMs,
  tokenFactory,
}) {
  if (
    typeof assertAuthenticatedSubject !== "function"
    || !Number.isSafeInteger(sessionTtlMs)
    || sessionTtlMs <= 0
    || typeof tokenFactory !== "function"
  ) {
    throw new TypeError("A trusted subject assertion, positive sessionTtlMs, and tokenFactory are required");
  }

  const sessions = new Map();
  const devices = new Map();
  const revocationVersions = new Map();
  const deviceKey = (subjectId, deviceId) => `${subjectId}\u0000${deviceId}`;

  function authenticate(token) {
    const session = sessions.get(token);
    if (!session || session.revoked) {
      throw new FoundationError(ERROR_CODES.SESSION_REVOKED, "Session is not active");
    }
    if (clock() >= session.expiresAtMs) {
      throw new FoundationError(ERROR_CODES.SESSION_EXPIRED, "Session has expired");
    }
    return session.subject;
  }

  function createSession(subject, deviceId, { replaceRevoked = false } = {}) {
    assertAuthenticatedSubject(subject);
    if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(deviceId)) {
      throw new TypeError("Device ID must be a bounded opaque identifier");
    }
    const key = deviceKey(subject.subjectId, deviceId);
    const existingDevice = devices.get(key);
    if (existingDevice?.revoked && !replaceRevoked) {
      throw new FoundationError(ERROR_CODES.DEVICE_REVOKED, "Device is not authorized to synchronize");
    }
    if (replaceRevoked && !existingDevice?.revoked) {
      throw new FoundationError(ERROR_CODES.DEVICE_REVOKED, "Device is not authorized to synchronize");
    }

    const token = tokenFactory();
    if (sessions.has(token)) {
      throw new FoundationError(ERROR_CODES.CONFLICT, "Generated session token is not unique");
    }
    const expiresAtMs = clock() + sessionTtlMs;
    devices.set(key, {
      subjectId: subject.subjectId,
      deviceId,
      revoked: false,
    });
    sessions.set(token, { subject, deviceId, expiresAtMs, revoked: false });
    return Object.freeze({ token, deviceId, expiresAt: new Date(expiresAtMs).toISOString() });
  }

  return Object.freeze({
    establishSession(subject, deviceId) {
      return createSession(subject, deviceId);
    },

    replaceRevokedDevice(subject, deviceId) {
      return createSession(subject, deviceId, { replaceRevoked: true });
    },

    authenticate,

    authorizeSynchronization(token, deviceId) {
      const session = sessions.get(token);
      if (!session || session.deviceId !== deviceId) {
        throw new FoundationError(ERROR_CODES.SESSION_REVOKED, "Session is not active");
      }
      const device = devices.get(deviceKey(session.subject.subjectId, deviceId));
      if (!device || device.revoked) {
        throw new FoundationError(ERROR_CODES.DEVICE_REVOKED, "Device is not authorized to synchronize");
      }
      return authenticate(token);
    },

    revokeAll(subjectId) {
      const affectedSessions = [...sessions.values()].filter((session) =>
        session.subject.subjectId === subjectId && !session.revoked);
      const affectedDevices = [...devices.values()].filter((device) =>
        device.subjectId === subjectId && !device.revoked);
      const revocationVersion = (revocationVersions.get(subjectId) ?? 0) + 1;

      for (const session of affectedSessions) session.revoked = true;
      for (const device of affectedDevices) device.revoked = true;
      revocationVersions.set(subjectId, revocationVersion);

      return Object.freeze({
        subjectId,
        revocationVersion,
        sessionsRevoked: affectedSessions.length,
        devicesRevoked: affectedDevices.length,
      });
    },
  });
}
