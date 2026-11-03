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

function notFound() {
  return new FoundationError(ERROR_CODES.NOT_FOUND, NOT_FOUND_MESSAGE);
}

function requireRepository(repository, name) {
  for (const method of ["getById", "listByOwner", "mutateByOwner"]) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`${name} repository must implement ${method}`);
    }
  }
  return repository;
}

function assertOwned(record, ownerDoctorId, activeOnly = false) {
  if (
    record === null
    || record?.ownerDoctorId !== ownerDoctorId
    || (activeOnly && record.status !== "ACTIVE")
  ) {
    throw notFound();
  }
  return record;
}

export function createDoctorOwnershipService({ assertAuthenticatedSubject, repositories } = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const configured = Object.fromEntries(RESOURCE_DEFINITIONS.map(([, repositoryName]) => [
    repositoryName,
    requireRepository(repositories?.[repositoryName], repositoryName),
  ]));

  function doctorId(subject) {
    return requireRole(subject, ROLES.DOCTOR).subjectId;
  }

  const service = {};
  for (const [resourceName, repositoryName, activeOnly] of RESOURCE_DEFINITIONS) {
    const repository = configured[repositoryName];

    service[`get${resourceName}`] = (subject, id) => {
      const ownerDoctorId = doctorId(subject);
      return assertOwned(repository.getById(id), ownerDoctorId, activeOnly);
    };

    service[`list${resourceName}s`] = (subject) => {
      const ownerDoctorId = doctorId(subject);
      const records = repository.listByOwner(ownerDoctorId);
      if (!Array.isArray(records)) throw new TypeError(`${repositoryName} list must return an array`);
      return records.filter((record) =>
        record?.ownerDoctorId === ownerDoctorId && (!activeOnly || record.status === "ACTIVE"));
    };

    service[`mutate${resourceName}`] = (subject, id, mutation) => {
      const ownerDoctorId = doctorId(subject);
      if (activeOnly) assertOwned(repository.getById(id), ownerDoctorId, true);
      const updated = repository.mutateByOwner(id, ownerDoctorId, mutation);
      return assertOwned(updated, ownerDoctorId);
    };
  }

  return Object.freeze(service);
}
