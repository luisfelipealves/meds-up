import { ERROR_CODES, ROLES } from "@medsup/contracts";
import { FoundationError } from "../identity/errors.mjs";
import { createRoleGuard } from "../identity/subject.mjs";

const NOT_FOUND_MESSAGE = "The resource was not found.";
const RESOURCE_DEFINITIONS = Object.freeze([
  ["ActiveReviewSession", "activeReviewSessions", true],
  ["ConfirmedPrescription", "confirmedPrescriptions", false],
  ["PrescriptionVersion", "prescriptionVersions", false],
  ["AuditReference", "auditReferences", false],
  ["ClaimControl", "claimControls", false],
]);
const AUTHORITY_FIELDS = new Set(["ownerDoctorId", "confirmedByDoctorId", "actorDoctorId", "authorization"]);
const SESSION_CONTENT_FIELDS = new Set(["document", "sourceDocument", "rawOcr", "rawAiOutput", "unconfirmedProposal", "proposal", "clinicalContent"]);
const SESSION_METADATA_FIELDS = new Set(["id", "reviewSessionId", "status", "createdAt", "updatedAt", "expiresAt"]);

function notFound() { return new FoundationError(ERROR_CODES.NOT_FOUND, NOT_FOUND_MESSAGE); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }

/** Internal repository contract: public resource plus server-only authorization metadata. */
export function createAuthorizationRepositoryProjection(record, ownerDoctorId) {
  if (!isObject(record) || typeof ownerDoctorId !== "string" || ownerDoctorId.length === 0) throw new TypeError("authorization repository projection requires a record and ownerDoctorId");
  return Object.freeze({ record: structuredClone(record), authorization: Object.freeze({ ownerDoctorId }) });
}

function unpackProjection(projection, name) {
  if (!isObject(projection) || !isObject(projection.record) || !isObject(projection.authorization) || typeof projection.authorization.ownerDoctorId !== "string") throw new TypeError(`${name} repository must return an authorization projection`);
  return projection;
}

function assertOwned(projection, ownerDoctorId, activeOnly = false, name = "resource") {
  if (projection === null) throw notFound();
  const value = unpackProjection(projection, name);
  if (value.authorization.ownerDoctorId !== ownerDoctorId || (activeOnly && value.record.status !== "ACTIVE")) throw notFound();
  return value;
}

function sanitizeMutation(value, activeOnly) {
  if (!isObject(value)) throw new TypeError("mutation must be an object");
  const forbidden = activeOnly ? new Set([...AUTHORITY_FIELDS, ...SESSION_CONTENT_FIELDS]) : AUTHORITY_FIELDS;
  const sanitize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(sanitize);
    if (!isObject(candidate)) return candidate;
    return Object.fromEntries(Object.entries(candidate).filter(([key]) => !forbidden.has(key)).map(([key, item]) => [key, sanitize(item)]));
  };
  return sanitize(value);
}

function projectSession(record) { return Object.fromEntries(Object.entries(record).filter(([key]) => SESSION_METADATA_FIELDS.has(key))); }
function publicRecord(projection, activeOnly, name) { const value = unpackProjection(projection, name).record; return activeOnly ? projectSession(value) : value; }

function requireRepository(repository, name) {
  for (const method of ["getById", "listByOwner", "mutateByOwner"]) if (typeof repository?.[method] !== "function") throw new TypeError(`${name} repository must implement ${method}`);
  return repository;
}

export function createDoctorOwnershipService({ assertAuthenticatedSubject, repositories } = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const configured = Object.fromEntries(RESOURCE_DEFINITIONS.map(([, repositoryName]) => [repositoryName, requireRepository(repositories?.[repositoryName], repositoryName)]));
  function doctorId(subject) { return requireRole(subject, ROLES.DOCTOR).subjectId; }
  const service = {};
  for (const [resourceName, repositoryName, activeOnly] of RESOURCE_DEFINITIONS) {
    const repository = configured[repositoryName];
    service[`get${resourceName}`] = (subject, id) => {
      const ownerDoctorId = doctorId(subject);
      return publicRecord(assertOwned(repository.getById(id), ownerDoctorId, activeOnly, repositoryName), activeOnly, repositoryName);
    };
    service[`list${resourceName}s`] = (subject) => {
      const ownerDoctorId = doctorId(subject);
      const records = repository.listByOwner(ownerDoctorId);
      if (!Array.isArray(records)) throw new TypeError(`${repositoryName} list must return an array`);
      return records
        .map((record) => unpackProjection(record, repositoryName))
        .filter((record) => record.authorization.ownerDoctorId === ownerDoctorId && (!activeOnly || record.record.status === "ACTIVE"))
        .map((record) => publicRecord(record, activeOnly, repositoryName));
    };
    service[`mutate${resourceName}`] = (subject, id, mutation) => {
      const ownerDoctorId = doctorId(subject);
      const updated = repository.mutateByOwner(id, ownerDoctorId, sanitizeMutation(mutation, activeOnly), { activeOnly });
      return publicRecord(assertOwned(updated, ownerDoctorId, false, repositoryName), activeOnly, repositoryName);
    };
  }
  return Object.freeze(service);
}
