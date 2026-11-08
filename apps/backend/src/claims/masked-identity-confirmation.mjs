import { ERROR_CODES, ROLES } from "@medsup/contracts";
import { FoundationError } from "../identity/errors.mjs";
import { createRoleGuard } from "../identity/subject.mjs";

const GENERIC_FAILURE_MESSAGE = "Please contact your doctor or clinic.";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INITIALS_PATTERN = /^\p{L}{1,2}$/u;
const OUTCOMES = new Set(["PREVIEWED", "CONFIRMED", "INVALID_TOKEN", "DOB_MISMATCH", "RATE_LIMITED", "INTERNAL_ERROR"]);
const FAILED_OUTCOMES = new Set(["INVALID_TOKEN", "DOB_MISMATCH", "RATE_LIMITED", "INTERNAL_ERROR"]);

function clone(value) { return structuredClone(value); }
function genericFailure() { return new FoundationError(ERROR_CODES.CLAIM_IDENTITY_FAILED, GENERIC_FAILURE_MESSAGE); }
function isGenericFailure(error) { return error?.code === ERROR_CODES.CLAIM_IDENTITY_FAILED && error?.message === GENERIC_FAILURE_MESSAGE; }
function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function requireOpaqueId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new TypeError(`${label} must be an opaque ID`);
  return value;
}
function requireClock(clock) {
  const now = clock();
  if (!Number.isSafeInteger(now) || now < 0) throw new TypeError("Clock must return epoch milliseconds");
  return now;
}
function isCivilDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function requireCivilDate(value, label) {
  if (!isCivilDate(value)) throw new TypeError(`${label} must be a canonical civil date`);
  return value;
}

function normalizeIssuerDisplayName(value) {
  if (typeof value !== "string") throw new TypeError("Issuer display name is not allow-listed");
  const normalized = value.normalize("NFKC");
  if (normalized !== value || normalized.length < 1 || normalized.length > 120 || /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(normalized)) {
    throw new TypeError("Issuer display name is not allow-listed");
  }
  return normalized;
}

/** Derives at most first/last initials at the trusted boundary; full names never leave it. */
export function maskPatientName(patientName) {
  if (typeof patientName !== "string") throw new TypeError("Patient name must be a string");
  const parts = patientName.normalize("NFKC").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || parts.some((part) => !/^\p{L}+(?:['’-]\p{L}+)*$/u.test(part))) {
    throw new TypeError("Patient name must contain unambiguous letters");
  }
  const initials = [parts[0][0], ...(parts.length > 1 ? [parts.at(-1)[0]] : [])].join("").toLocaleUpperCase("und");
  if (!INITIALS_PATTERN.test(initials)) throw new TypeError("Patient initials are invalid");
  return initials;
}

function validateProjection(projection, isAllowedIssuerDisplayName) {
  if (!isRecord(projection)) throw new TypeError("Claim identity projection must be an object");
  const keys = Object.keys(projection).sort();
  if (keys.join(",") !== "claimTokenId,dateOfBirth,initials,issuerDisplayName,prescriptionId") throw new TypeError("Claim identity projection has an invalid shape");
  requireOpaqueId(projection.claimTokenId, "claimTokenId");
  requireOpaqueId(projection.prescriptionId, "prescriptionId");
  requireCivilDate(projection.dateOfBirth, "dateOfBirth");
  const issuerDisplayName = normalizeIssuerDisplayName(projection.issuerDisplayName);
  if (isAllowedIssuerDisplayName(issuerDisplayName) !== true) {
    throw new TypeError("Issuer display name is not allow-listed");
  }
  if (typeof projection.initials !== "string" || !INITIALS_PATTERN.test(projection.initials)) throw new TypeError("Patient initials are invalid");
  return { ...projection, issuerDisplayName };
}

function requireRepository(repository) {
  for (const method of ["getByClaimTokenId", "recordAttempt", "failedAttempts", "inspectForTests"]) {
    if (typeof repository?.[method] !== "function") throw new TypeError(`Claim identity repository must implement ${method}`);
  }
  return repository;
}

function publicAudit(record) {
  return Object.freeze({
    claimAttemptId: record.claimAttemptId,
    actorPatientSubjectId: record.actorPatientSubjectId,
    claimTokenId: record.claimTokenId,
    operation: record.operation,
    outcome: record.outcome,
    occurredAt: record.occurredAt,
  });
}

export function createClaimIdentityConfirmationService({
  assertAuthenticatedSubject,
  claimTokenLifecycle,
  repository,
  clock = Date.now,
  createId,
  rateLimit = Object.freeze({ maxFailedAttempts: 5, windowMs: 15 * 60 * 1000 }),
  isAllowedIssuerDisplayName,
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const identityRepository = requireRepository(repository);
  if (typeof claimTokenLifecycle?.resolveForConfirmation !== "function" || typeof claimTokenLifecycle?.consume !== "function" || typeof claimTokenLifecycle?.consumeAtomically !== "function") throw new TypeError("A claim-token lifecycle boundary is required");
  if (typeof createId !== "function") throw new TypeError("A provider-neutral identifier generator is required");
  if (typeof isAllowedIssuerDisplayName !== "function") throw new TypeError("An issuer allow-list is required");
  if (!Number.isSafeInteger(rateLimit?.maxFailedAttempts) || rateLimit.maxFailedAttempts < 1 || !Number.isSafeInteger(rateLimit?.windowMs) || rateLimit.windowMs < 1) throw new TypeError("A bounded rate-limit policy is required");
  const capabilities = new WeakMap();

  function patient(subject) { return requireRole(subject, ROLES.PATIENT); }
  function attemptId() { return requireOpaqueId(createId("claim_identity_attempt"), "attempt ID"); }
  function recordAttempt({ subjectId, claimTokenId = null, operation, outcome, now, attempt }) {
    if (!OUTCOMES.has(outcome)) throw new TypeError("Audit outcome is not allow-listed");
    return identityRepository.recordAttempt({ claimAttemptId: attempt, actorPatientSubjectId: subjectId, claimTokenId, operation, outcome, now });
  }
  function safeRecordAttempt(record) {
    try { return recordAttempt(record); } catch { return null; }
  }
  function limited(subjectId, now) {
    return identityRepository.failedAttempts(subjectId, now, rateLimit.windowMs) >= rateLimit.maxFailedAttempts;
  }
  function projectionFor(subject, rawToken, now) {
    const token = claimTokenLifecycle.resolveForConfirmation(subject, { rawToken });
    if (token === null) return null;
    const projection = identityRepository.getByClaimTokenId(token.claimTokenId);
    if (projection === null) return null;
    return { token, projection: validateProjection(projection, isAllowedIssuerDisplayName) };
  }
  function masked(projection) {
    return Object.freeze({ initials: projection.initials, issuerDisplayName: projection.issuerDisplayName });
  }

  return Object.freeze({
    preview(subject, command) {
      const actor = patient(subject);
      const now = requireClock(clock);
      const attempt = attemptId();
      let result = null;
      try {
        if (limited(actor.subjectId, now)) {
          safeRecordAttempt({ subjectId: actor.subjectId, operation: "PREVIEW", outcome: "RATE_LIMITED", now, attempt });
          throw genericFailure();
        }
        result = projectionFor(actor, command?.rawToken, now);
        if (result === null) {
          safeRecordAttempt({ subjectId: actor.subjectId, operation: "PREVIEW", outcome: "INVALID_TOKEN", now, attempt });
          throw genericFailure();
        }
        if (!safeRecordAttempt({ subjectId: actor.subjectId, claimTokenId: result.token.claimTokenId, operation: "PREVIEW", outcome: "PREVIEWED", now, attempt })) throw new Error("Audit unavailable");
        return masked(result.projection);
      } catch (error) {
        if (isGenericFailure(error)) throw error;
        safeRecordAttempt({ subjectId: actor.subjectId, operation: "PREVIEW", outcome: "INTERNAL_ERROR", now, attempt });
        throw genericFailure();
      }
    },

    confirm(subject, command) {
      const actor = patient(subject);
      const now = requireClock(clock);
      const attempt = attemptId();
      try {
        if (limited(actor.subjectId, now)) {
          safeRecordAttempt({ subjectId: actor.subjectId, operation: "CONFIRM", outcome: "RATE_LIMITED", now, attempt });
          throw genericFailure();
        }
        const rawToken = command?.rawToken;
        const suppliedDob = command?.dateOfBirth;
        const result = projectionFor(actor, rawToken, now);
        if (result === null || !isCivilDate(suppliedDob)) {
          safeRecordAttempt({ subjectId: actor.subjectId, claimTokenId: result?.token.claimTokenId ?? null, operation: "CONFIRM", outcome: result === null ? "INVALID_TOKEN" : "DOB_MISMATCH", now, attempt });
          throw genericFailure();
        }
        if (suppliedDob !== result.projection.dateOfBirth) {
          safeRecordAttempt({ subjectId: actor.subjectId, claimTokenId: result.token.claimTokenId, operation: "CONFIRM", outcome: "DOB_MISMATCH", now, attempt });
          throw genericFailure();
        }
        if (!safeRecordAttempt({ subjectId: actor.subjectId, claimTokenId: result.token.claimTokenId, operation: "CONFIRM", outcome: "CONFIRMED", now, attempt })) throw new Error("Audit unavailable");
        const capability = Object.freeze({ type: "CLAIM_IDENTITY_CONFIRMED", version: 1 });
        capabilities.set(capability, Object.freeze({ subjectId: actor.subjectId, rawToken }));
        return capability;
      } catch (error) {
        if (isGenericFailure(error)) throw error;
        safeRecordAttempt({ subjectId: actor.subjectId, operation: "CONFIRM", outcome: "INTERNAL_ERROR", now, attempt });
        throw genericFailure();
      }
    },

    // Explicit hand-off for the next lifecycle step. No association is made here.
    consumeConfirmed(subject, capability) {
      const actor = patient(subject);
      const pending = capabilities.get(capability);
      if (pending?.subjectId !== actor.subjectId) throw genericFailure();
      capabilities.delete(capability);
      return claimTokenLifecycle.consume(subject, { rawToken: pending.rawToken });
    },

    completeConfirmed(subject, capability, prepare) {
      const actor = patient(subject);
      const pending = capabilities.get(capability);
      if (pending?.subjectId !== actor.subjectId || typeof prepare !== "function") throw genericFailure();
      if (Object.hasOwn(pending, "completedResult")) return clone(pending.completedResult);
      try {
        const result = claimTokenLifecycle.consumeAtomically(subject, { rawToken: pending.rawToken }, prepare);
        capabilities.set(capability, Object.freeze({ subjectId: actor.subjectId, completedResult: clone(result) }));
        return result;
      } catch {
        throw genericFailure();
      }
    },

    inspectAuditForTests() { return identityRepository.inspectForTests(); },
  });
}

export function createInMemoryClaimIdentityRepository({ projections = [], beforeCommit = () => {} } = {}) {
  if (!Array.isArray(projections) || typeof beforeCommit !== "function") throw new TypeError("Invalid identity repository options");
  const byToken = new Map();
  const attempts = new Map();
  for (const projection of projections) {
    const normalized = validateProjection(projection, () => true);
    byToken.set(normalized.claimTokenId, Object.freeze(clone(normalized)));
  }
  return Object.freeze({
    getByClaimTokenId(claimTokenId) { return byToken.has(claimTokenId) ? clone(byToken.get(claimTokenId)) : null; },
    recordAttempt(record) {
      const normalized = {
        claimAttemptId: requireOpaqueId(record.claimAttemptId, "claim attempt ID"),
        actorPatientSubjectId: requireOpaqueId(record.actorPatientSubjectId, "patient subject ID"),
        claimTokenId: record.claimTokenId === null ? null : requireOpaqueId(record.claimTokenId, "claim token ID"),
        operation: ["PREVIEW", "CONFIRM"].includes(record.operation) ? record.operation : null,
        outcome: OUTCOMES.has(record.outcome) ? record.outcome : null,
        occurredAt: new Date(record.now).toISOString(),
      };
      if (normalized.operation === null || normalized.outcome === null || attempts.has(normalized.claimAttemptId)) throw new TypeError("Invalid claim identity audit record");
      attempts.set(normalized.claimAttemptId, Object.freeze(normalized));
      try { beforeCommit(clone(normalized)); } catch (error) { attempts.delete(normalized.claimAttemptId); throw error; }
      return publicAudit(normalized);
    },
    failedAttempts(subjectId, now, windowMs) {
      return [...attempts.values()].filter((record) => record.actorPatientSubjectId === subjectId && FAILED_OUTCOMES.has(record.outcome) && Date.parse(record.occurredAt) > now - windowMs).length;
    },
    inspectForTests() { return clone({ projections: [...byToken.values()], attempts: [...attempts.values()] }); },
  });
}
