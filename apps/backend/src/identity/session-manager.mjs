import { ERROR_CODES, FoundationError } from "./errors.mjs";
import { assertAuthenticatedSubject } from "./subject.mjs";

export function createSessionManager({ clock = Date.now, sessionTtlMs, tokenFactory }) {
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0 || typeof tokenFactory !== "function") {
    throw new TypeError("A positive sessionTtlMs and tokenFactory are required");
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

  return Object.freeze({
    establishSession(subject, deviceId) {
      assertAuthenticatedSubject(subject);
      const token = tokenFactory();
      const expiresAtMs = clock() + sessionTtlMs;
      devices.set(deviceKey(subject.subjectId, deviceId), {
        subjectId: subject.subjectId,
        deviceId,
        revoked: false,
      });
      sessions.set(token, { subject, deviceId, expiresAtMs, revoked: false });
      return Object.freeze({ token, deviceId, expiresAt: new Date(expiresAtMs).toISOString() });
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
