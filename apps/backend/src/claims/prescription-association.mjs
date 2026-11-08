import { ROLES } from "@medsup/contracts";
import { createRoleGuard } from "../identity/subject.mjs";

function clone(value) { return structuredClone(value); }
function requireOpaqueId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) throw new TypeError(`${label} must be an opaque ID`);
  return value;
}
function requireRepository(repository) {
  for (const method of ["prepareAssociation", "listByPatient", "inspectForTests"]) {
    if (typeof repository?.[method] !== "function") throw new TypeError(`Prescription association repository must implement ${method}`);
  }
  return repository;
}

export function createPrescriptionAssociationService({
  assertAuthenticatedSubject,
  claimIdentityConfirmation,
  repository,
  createId,
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const associations = requireRepository(repository);
  if (typeof claimIdentityConfirmation?.completeConfirmed !== "function") throw new TypeError("A confirmed claim completion boundary is required");
  if (typeof createId !== "function") throw new TypeError("A provider-neutral identifier generator is required");
  const patient = (subject) => requireRole(subject, ROLES.PATIENT);

  return Object.freeze({
    async associateConfirmed(subject, capability) {
      const actor = patient(subject);
      const result = claimIdentityConfirmation.completeConfirmed(actor, capability, (claim) => associations.prepareAssociation({
        ...claim,
        patientAssociationId: requireOpaqueId(createId("patient_association"), "patient association ID"),
        auditEventId: requireOpaqueId(createId("association_audit"), "association audit ID"),
        occurredAt: new Date(claim.now).toISOString(),
      }));
      return clone(result);
    },

    listForPatient(subject) {
      return associations.listByPatient(patient(subject).subjectId).map(clone);
    },
  });
}

export function createInMemoryPrescriptionAssociationRepository({ beforeCommit = () => {} } = {}) {
  if (typeof beforeCommit !== "function") throw new TypeError("beforeCommit must be a function");
  const byPrescription = new Map();
  const audits = [];

  return Object.freeze({
    prepareAssociation(input) {
      const association = Object.freeze({
        patientAssociationId: requireOpaqueId(input.patientAssociationId, "patient association ID"),
        prescriptionId: requireOpaqueId(input.prescriptionId, "prescription ID"),
        patientSubjectId: requireOpaqueId(input.patientSubjectId, "patient subject ID"),
        ownerDoctorId: requireOpaqueId(input.ownerDoctorId, "doctor subject ID"),
        associatedAt: input.occurredAt,
      });
      const audit = Object.freeze({
        auditEventId: requireOpaqueId(input.auditEventId, "association audit ID"),
        eventType: "CLAIMED_PRESCRIPTION_ASSOCIATED",
        outcome: "COMPLETED",
        actorPatientSubjectId: association.patientSubjectId,
        patientAssociationId: association.patientAssociationId,
        prescriptionId: association.prescriptionId,
        ownerDoctorId: association.ownerDoctorId,
        occurredAt: input.occurredAt,
      });
      if (byPrescription.has(association.prescriptionId)) throw new TypeError("Prescription already has a patient association");
      let committed = false;
      return Object.freeze({
        commit() {
          byPrescription.set(association.prescriptionId, association);
          audits.push(audit);
          try { beforeCommit(clone({ association, audit })); } catch (error) {
            byPrescription.delete(association.prescriptionId);
            audits.pop();
            throw error;
          }
          committed = true;
          return Object.freeze({ association: clone(association), audit: clone(audit) });
        },
        rollback() {
          if (!committed) return;
          byPrescription.delete(association.prescriptionId);
          const index = audits.findIndex(({ auditEventId }) => auditEventId === audit.auditEventId);
          if (index >= 0) audits.splice(index, 1);
          committed = false;
        },
      });
    },
    listByPatient(patientSubjectId) {
      return [...byPrescription.values()].filter((association) => association.patientSubjectId === patientSubjectId).map(clone);
    },
    inspectForTests() { return clone({ associations: [...byPrescription.values()], audits }); },
  });
}
