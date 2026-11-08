import { createHash, randomBytes } from "node:crypto";
import { ERROR_CODES, ROLES } from "@medsup/contracts";
import { FoundationError } from "../identity/errors.mjs";
import { createRoleGuard } from "../identity/subject.mjs";

export const CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const RAW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const GENERATED_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const FAILED_OUTCOMES = new Set([
  "INVALID_TOKEN",
  "EXPIRED",
  "REVOKED",
  "REPLACED",
  "ALREADY_CONSUMED",
  "FAILED",
]);

function clone(value) {
  return structuredClone(value);
}

function failure(code, message) {
  return new FoundationError(code, message);
}

function notFound() {
  return failure(ERROR_CODES.NOT_FOUND, "The resource was not found.");
}

function claimFailure() {
  return failure(ERROR_CODES.CONFLICT, "The claim could not be completed.");
}

function requireTime(clock) {
  const now = clock();
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError("Clock must return epoch milliseconds");
  return now;
}

function requireGeneratedId(value) {
  if (typeof value !== "string" || !GENERATED_ID_PATTERN.test(value)) {
    throw new TypeError("Generated identifiers must be opaque IDs");
  }
  return value;
}

function publicControl(token) {
  return Object.freeze({
    claimTokenId: token.claimTokenId,
    prescriptionId: token.prescriptionId,
    status: token.status,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    replacedAt: token.replacedAt,
    replacementClaimTokenId: token.replacementClaimTokenId,
    consumedAt: token.consumedAt,
  });
}

function defaultGenerateRawToken() {
  return randomBytes(32).toString("base64url");
}

function defaultDigestToken(rawToken) {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function isRawToken(rawToken) {
  if (typeof rawToken !== "string" || !RAW_TOKEN_PATTERN.test(rawToken)) return false;
  try {
    return Buffer.from(rawToken, "base64url").byteLength === 32;
  } catch {
    return false;
  }
}

function requireRepository(repository) {
  for (const method of ["issue", "getByOwner", "listByOwner", "revoke", "replace", "consume", "consumeAtomically", "resolveForConfirmation"]) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`Claim-token repository must implement ${method}`);
    }
  }
  return repository;
}

export function createClaimTokenService({
  assertAuthenticatedSubject,
  authorizePrescriptionOwnership,
  repository,
  clock = Date.now,
  createId,
  generateRawToken = defaultGenerateRawToken,
  digestToken = defaultDigestToken,
  rateLimit = Object.freeze({ maxFailedAttempts: 5, windowMs: 15 * 60 * 1000 }),
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const tokens = requireRepository(repository);
  if (typeof authorizePrescriptionOwnership !== "function") throw new TypeError("A trusted prescription ownership authority is required");
  if (typeof clock !== "function") throw new TypeError("A clock is required");
  if (typeof createId !== "function") throw new TypeError("A provider-neutral identifier generator is required");
  if (typeof generateRawToken !== "function" || typeof digestToken !== "function") throw new TypeError("Token generation and digest capabilities are required");
  if (!Number.isSafeInteger(rateLimit?.maxFailedAttempts) || rateLimit.maxFailedAttempts < 1) throw new TypeError("Rate-limit maximum must be a positive integer");
  if (!Number.isSafeInteger(rateLimit?.windowMs) || rateLimit.windowMs < 1) throw new TypeError("Rate-limit window must be a positive integer");

  function doctor(subject) {
    return requireRole(subject, ROLES.DOCTOR);
  }

  function patient(subject) {
    return requireRole(subject, ROLES.PATIENT);
  }

  function newSecret() {
    const rawToken = generateRawToken();
    if (!isRawToken(rawToken)) throw new TypeError("Token generator must return 256 random bits encoded as unpadded base64url");
    const tokenDigest = digestToken(rawToken);
    if (typeof tokenDigest !== "string" || !/^[a-f0-9]{64}$/.test(tokenDigest)) throw new TypeError("Token digest must be a lowercase SHA-256 hex digest");
    return Object.freeze({ rawToken, tokenDigest });
  }

  function issuance(ownerDoctorId, prescriptionId, now) {
    const secret = newSecret();
    return Object.freeze({
      secret,
      record: Object.freeze({
        claimTokenId: requireGeneratedId(createId("claim_token")),
        prescriptionId,
        ownerDoctorId,
        tokenDigest: secret.tokenDigest,
        status: "ACTIVE",
        issuedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + CLAIM_TOKEN_TTL_MS).toISOString(),
        revokedAt: null,
        replacedAt: null,
        replacementClaimTokenId: null,
        consumedAt: null,
      }),
    });
  }

  function delivery(result, rawToken) {
    return Object.freeze({
      claimTokenId: result.claimTokenId,
      expiresAt: result.expiresAt,
      // The sole raw-secret output is the QR delivery payload. No URL is built.
      qrPayload: rawToken,
    });
  }

  return Object.freeze({
    async issue(subject, command) {
      const actor = doctor(subject);
      const prescriptionId = command?.prescriptionId;
      if (typeof prescriptionId !== "string" || prescriptionId.length === 0) throw notFound();
      if (authorizePrescriptionOwnership(actor, prescriptionId) !== true) throw notFound();
      const prepared = issuance(actor.subjectId, prescriptionId, requireTime(clock));
      const stored = tokens.issue(prepared.record);
      return delivery(stored, prepared.secret.rawToken);
    },

    getControl(subject, claimTokenId) {
      return clone(publicControl(tokens.getByOwner(claimTokenId, doctor(subject).subjectId)));
    },

    listControls(subject) {
      return tokens.listByOwner(doctor(subject).subjectId).map((record) => clone(publicControl(record)));
    },

    async revoke(subject, command) {
      const actor = doctor(subject);
      return clone(publicControl(tokens.revoke({
        claimTokenId: command?.claimTokenId,
        ownerDoctorId: actor.subjectId,
        now: requireTime(clock),
      })));
    },

    async replace(subject, command) {
      const actor = doctor(subject);
      const current = tokens.getByOwner(command?.claimTokenId, actor.subjectId);
      const now = requireTime(clock);
      const prepared = issuance(actor.subjectId, current.prescriptionId, now);
      const stored = tokens.replace({
        claimTokenId: current.claimTokenId,
        ownerDoctorId: actor.subjectId,
        replacement: prepared.record,
        now,
      });
      return delivery(stored, prepared.secret.rawToken);
    },

    async consume(subject, command) {
      const actor = patient(subject);
      const now = requireTime(clock);
      const rawToken = command?.rawToken;
      const validFormat = isRawToken(rawToken);
      const tokenDigest = validFormat ? digestToken(rawToken) : null;
      const result = tokens.consume({
        tokenDigest,
        validFormat,
        patientSubjectId: actor.subjectId,
        attemptId: requireGeneratedId(createId("claim_attempt")),
        now,
        rateLimit,
      });
      if (!result.success) throw claimFailure();
      return Object.freeze({ claimTokenId: result.claimTokenId, prescriptionId: result.prescriptionId });
    },

    consumeAtomically(subject, command, prepare) {
      const actor = patient(subject);
      if (typeof prepare !== "function") throw new TypeError("An atomic claim completion preparer is required");
      const now = requireTime(clock);
      const rawToken = command?.rawToken;
      const validFormat = isRawToken(rawToken);
      const tokenDigest = validFormat ? digestToken(rawToken) : null;
      const result = tokens.consumeAtomically({
        tokenDigest,
        validFormat,
        patientSubjectId: actor.subjectId,
        attemptId: requireGeneratedId(createId("claim_attempt")),
        now,
        rateLimit,
        prepare,
      });
      if (!result.success) throw claimFailure();
      return result.result;
    },

    // Internal provider-neutral boundary for DEV-009. It deliberately does not
    // mutate lifecycle state or return a secret; identity confirmation owns the
    // decision whether a later, explicit consume is allowed.
    resolveForConfirmation(subject, command) {
      const actor = patient(subject);
      const rawToken = command?.rawToken;
      const validFormat = isRawToken(rawToken);
      if (!validFormat) return null;
      const tokenDigest = digestToken(rawToken);
      return tokens.resolveForConfirmation({ tokenDigest, now: requireTime(clock), patientSubjectId: actor.subjectId });
    },
  });
}

export function createInMemoryClaimTokenRepository({ beforeCommit = () => {} } = {}) {
  if (typeof beforeCommit !== "function") throw new TypeError("beforeCommit must be a function");
  const tokenById = new Map();
  const tokenIdByDigest = new Map();
  const attemptById = new Map();

  function snapshot() {
    return clone({ tokenById, tokenIdByDigest, attemptById });
  }

  function restore(state) {
    tokenById.clear();
    tokenIdByDigest.clear();
    attemptById.clear();
    for (const [key, value] of state.tokenById) tokenById.set(key, value);
    for (const [key, value] of state.tokenIdByDigest) tokenIdByDigest.set(key, value);
    for (const [key, value] of state.attemptById) attemptById.set(key, value);
  }

  function atomically(operation, mutate) {
    const before = snapshot();
    try {
      const result = mutate();
      beforeCommit(operation, clone(result));
      return clone(result);
    } catch (error) {
      restore(before);
      throw error;
    }
  }

  function owned(claimTokenId, ownerDoctorId) {
    const token = tokenById.get(claimTokenId);
    if (token === undefined || token.ownerDoctorId !== ownerDoctorId) throw notFound();
    return token;
  }

  function assertUnique(record) {
    if (tokenById.has(record.claimTokenId) || tokenIdByDigest.has(record.tokenDigest)) throw failure(ERROR_CODES.CONFLICT, "The request conflicts with the resource state.");
  }

  function persist(record) {
    const frozen = Object.freeze(clone(record));
    tokenById.set(frozen.claimTokenId, frozen);
    tokenIdByDigest.set(frozen.tokenDigest, frozen.claimTokenId);
    return frozen;
  }

  function audit({ attemptId, patientSubjectId, claimTokenId, outcome, now }) {
    if (attemptById.has(attemptId)) throw failure(ERROR_CODES.CONFLICT, "The request conflicts with the resource state.");
    const record = Object.freeze({
      claimAttemptId: attemptId,
      actorPatientSubjectId: patientSubjectId,
      claimTokenId,
      outcome,
      occurredAt: new Date(now).toISOString(),
    });
    attemptById.set(attemptId, record);
    return record;
  }

  function failedAttempts(patientSubjectId, now, windowMs) {
    const cutoff = now - windowMs;
    return [...attemptById.values()].filter((attempt) =>
      attempt.actorPatientSubjectId === patientSubjectId
      && FAILED_OUTCOMES.has(attempt.outcome)
      && Date.parse(attempt.occurredAt) > cutoff,
    ).length;
  }

  function consumeAtomically({ tokenDigest, validFormat, patientSubjectId, attemptId, now, rateLimit, prepare }) {
    const before = snapshot();
    let prepared = null;
    try {
      if (failedAttempts(patientSubjectId, now, rateLimit.windowMs) >= rateLimit.maxFailedAttempts) {
        audit({ attemptId, patientSubjectId, claimTokenId: null, outcome: "RATE_LIMITED", now });
        const failed = Object.freeze({ success: false });
        beforeCommit("CONSUME", clone(failed));
        return clone(failed);
      }

      const claimTokenId = validFormat ? tokenIdByDigest.get(tokenDigest) : undefined;
      const token = claimTokenId === undefined ? undefined : tokenById.get(claimTokenId);
      let outcome = "INVALID_TOKEN";
      if (token !== undefined) {
        if (now >= Date.parse(token.expiresAt)) outcome = "EXPIRED";
        else if (token.status === "REVOKED") outcome = "REVOKED";
        else if (token.status === "REPLACED") outcome = "REPLACED";
        else if (token.status === "CONSUMED") outcome = "ALREADY_CONSUMED";
        else if (token.status === "ACTIVE") outcome = "CONSUMED";
      }

      if (outcome === "CONSUMED") {
        prepared = prepare(Object.freeze({
          claimTokenId: token.claimTokenId,
          prescriptionId: token.prescriptionId,
          ownerDoctorId: token.ownerDoctorId,
          patientSubjectId,
          now,
        }));
        if (typeof prepared?.commit !== "function" || typeof prepared?.rollback !== "function") {
          throw new TypeError("Atomic claim completion must provide commit and rollback");
        }
      }

      audit({ attemptId, patientSubjectId, claimTokenId: token?.claimTokenId ?? null, outcome, now });
      if (outcome !== "CONSUMED") {
        const failed = Object.freeze({ success: false });
        beforeCommit("CONSUME", clone(failed));
        return clone(failed);
      }

      const consumed = persist({ ...clone(token), status: "CONSUMED", consumedAt: new Date(now).toISOString() });
      const associated = prepared.commit();
      const completed = Object.freeze({
        success: true,
        claimTokenId: consumed.claimTokenId,
        prescriptionId: consumed.prescriptionId,
        result: clone(associated),
      });
      beforeCommit("CONSUME", clone(completed));
      return clone(completed);
    } catch (error) {
      restore(before);
      try {
        if (prepared !== null) prepared.rollback();
      } finally {
        audit({
          attemptId,
          patientSubjectId,
          claimTokenId: validFormat ? tokenIdByDigest.get(tokenDigest) ?? null : null,
          outcome: "FAILED",
          now,
        });
      }
      throw error;
    }
  }

  return Object.freeze({
    issue(record) {
      return atomically("ISSUE", () => {
        assertUnique(record);
        const hasActive = [...tokenById.values()].some((token) => token.prescriptionId === record.prescriptionId && token.status === "ACTIVE");
        if (hasActive) throw failure(ERROR_CODES.CONFLICT, "The request conflicts with the resource state.");
        return persist(record);
      });
    },

    getByOwner(claimTokenId, ownerDoctorId) {
      return clone(owned(claimTokenId, ownerDoctorId));
    },

    listByOwner(ownerDoctorId) {
      return [...tokenById.values()].filter((token) => token.ownerDoctorId === ownerDoctorId).map(clone);
    },

    revoke({ claimTokenId, ownerDoctorId, now }) {
      return atomically("REVOKE", () => {
        const current = owned(claimTokenId, ownerDoctorId);
        if (current.status !== "ACTIVE") throw failure(ERROR_CODES.CONFLICT, "The request conflicts with the resource state.");
        return persist({ ...clone(current), status: "REVOKED", revokedAt: new Date(now).toISOString() });
      });
    },

    replace({ claimTokenId, ownerDoctorId, replacement, now }) {
      return atomically("REPLACE", () => {
        const current = owned(claimTokenId, ownerDoctorId);
        if (current.status !== "ACTIVE") throw failure(ERROR_CODES.CONFLICT, "The request conflicts with the resource state.");
        if (replacement.prescriptionId !== current.prescriptionId || replacement.ownerDoctorId !== ownerDoctorId) throw notFound();
        assertUnique(replacement);
        persist({
          ...clone(current),
          status: "REPLACED",
          replacedAt: new Date(now).toISOString(),
          replacementClaimTokenId: replacement.claimTokenId,
        });
        return persist(replacement);
      });
    },

    consume({ tokenDigest, validFormat, patientSubjectId, attemptId, now, rateLimit }) {
      const result = consumeAtomically({
        tokenDigest,
        validFormat,
        patientSubjectId,
        attemptId,
        now,
        rateLimit,
        prepare: () => Object.freeze({ commit: () => null, rollback: () => {} }),
      });
      return Object.freeze({
        success: result.success,
        ...(result.success ? { claimTokenId: result.claimTokenId, prescriptionId: result.prescriptionId } : {}),
      });
    },

    consumeAtomically,

    resolveForConfirmation({ tokenDigest, now }) {
      const claimTokenId = tokenIdByDigest.get(tokenDigest);
      const token = claimTokenId === undefined ? undefined : tokenById.get(claimTokenId);
      if (token === undefined || token.status !== "ACTIVE" || now >= Date.parse(token.expiresAt)) return null;
      return Object.freeze({ claimTokenId: token.claimTokenId, prescriptionId: token.prescriptionId });
    },

    inspectForTests() {
      return clone({
        tokens: [...tokenById.values()],
        attempts: [...attemptById.values()],
      });
    },
  });
}
