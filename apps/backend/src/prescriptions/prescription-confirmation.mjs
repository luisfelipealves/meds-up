import {
  API_VERSION,
  ContractValidationError,
  ERROR_CODES,
  ROLES,
  SCHEMA_VERSION,
  validateConfirmedPrescription,
  validateDoctorConfirmationCommand,
  validatePrescriptionClinicalChangeCommand,
  validatePrescriptionStatusCommand,
  validatePrescriptionStatusEvent,
  validatePrescriptionVersion,
  validatePrescriptionAuditRecord,
} from "@medsup/contracts";
import { FoundationError } from "../identity/errors.mjs";
import { createRoleGuard } from "../identity/subject.mjs";

const ERROR_MESSAGES = Object.freeze({
  [ERROR_CODES.VALIDATION_FAILED]: "The request is invalid.",
  [ERROR_CODES.NOT_FOUND]: "The resource was not found.",
  [ERROR_CODES.CONFLICT]: "The request conflicts with the resource state.",
  [ERROR_CODES.STALE_RESOURCE_VERSION]: "The resource changed; refresh and retry.",
  [ERROR_CODES.IDEMPOTENCY_CONFLICT]: "The idempotency key was already used for another request.",
});

function failure(code) {
  return new FoundationError(code, ERROR_MESSAGES[code]);
}

function clone(value) {
  return structuredClone(value);
}

function fingerprint(value) {
  return JSON.stringify(value);
}

function requireRepository(repository) {
  for (const method of [
    "prepareConfirmation",
    "replayConfirmation",
    "changeClinicalContent",
    "transitionStatus",
    "getByOwner",
    "listByOwner",
    "listVersionsByOwner",
    "listAuditByOwner",
    "listStatusEventsByOwner",
  ]) {
    if (typeof repository?.[method] !== "function") {
      throw new TypeError(`Confirmed prescription repository must implement ${method}`);
    }
  }
  return repository;
}

function validateAsCommand(validator, command) {
  try {
    return validator(command);
  } catch (cause) {
    if (cause instanceof ContractValidationError) throw failure(ERROR_CODES.VALIDATION_FAILED);
    throw cause;
  }
}

function assertPayloadOwner(command, doctorId) {
  if (command.ownerDoctorId !== doctorId || command.confirmation?.confirmedByDoctorId !== doctorId) {
    throw failure(ERROR_CODES.NOT_FOUND);
  }
}

function requireTimestamp(clock) {
  const milliseconds = clock();
  if (!Number.isSafeInteger(milliseconds)) throw new TypeError("Clock must return epoch milliseconds");
  return new Date(milliseconds).toISOString();
}

export function createPrescriptionConfirmationService({
  assertAuthenticatedSubject,
  confirmationBoundary,
  repository,
  clock = Date.now,
  createId,
} = {}) {
  const requireRole = createRoleGuard(assertAuthenticatedSubject);
  const confirmedRepository = requireRepository(repository);
  // This is a trusted synchronous transaction capability, not two ordered calls:
  // prepare must be side-effect free, commit must be rollback-capable, and the
  // capability must atomically coordinate session consumption with persistence.
  // A durable adapter must implement the same obligation in its database
  // transaction; this in-memory implementation is not a production adapter.
  if (typeof confirmationBoundary?.confirmAtomically !== "function" || confirmationBoundary.synchronous !== true) {
    throw new TypeError("A synchronous atomic confirmation boundary is required");
  }
  if (confirmationBoundary.confirmAtomically.constructor?.name === "AsyncFunction") {
    throw new TypeError("The atomic confirmation boundary must be synchronous");
  }
  if (typeof clock !== "function") throw new TypeError("A clock is required");
  if (typeof createId !== "function") throw new TypeError("A provider-neutral identifier generator is required");

  function doctor(subject) {
    return requireRole(subject, ROLES.DOCTOR);
  }

  function ids() {
    return Object.freeze({
      prescriptionId: createId("prescription"),
      auditReferenceId: createId("audit"),
      securityCorrelationId: createId("correlation"),
      eventId: createId("event"),
    });
  }

  return Object.freeze({
    async confirm(subject, rawCommand) {
      const actor = doctor(subject);
      const command = validateAsCommand(validateDoctorConfirmationCommand, rawCommand);
      assertPayloadOwner(command, actor.subjectId);
      const replayed = confirmedRepository.replayConfirmation(Object.freeze({
        ownerDoctorId: actor.subjectId,
        reviewSessionId: command.reviewSessionId,
        idempotencyKey: command.idempotencyKey,
        clinicalContent: clone(command.correctedClinicalContent),
      }));
      if (replayed !== null) return clone(replayed);
      const outcome = confirmationBoundary.confirmAtomically(Object.freeze({
        actor,
        reviewSessionId: command.reviewSessionId,
        prepare: () => confirmedRepository.prepareConfirmation(Object.freeze({
        ownerDoctorId: actor.subjectId,
        reviewSessionId: command.reviewSessionId,
        idempotencyKey: command.idempotencyKey,
        clinicalContent: clone(command.correctedClinicalContent),
        occurredAt: requireTimestamp(clock),
        ids: ids(),
        })),
      }));
      if (outcome instanceof Promise) throw new TypeError("The atomic confirmation boundary returned asynchronously");
      return clone(outcome.result);
    },

    async changeClinicalContent(subject, rawCommand) {
      const actor = doctor(subject);
      const command = validateAsCommand(validatePrescriptionClinicalChangeCommand, rawCommand);
      assertPayloadOwner(command, actor.subjectId);
      const outcome = confirmedRepository.changeClinicalContent(Object.freeze({
        ownerDoctorId: actor.subjectId,
        prescriptionId: command.prescriptionId,
        expectedResourceVersion: command.expectedResourceVersion,
        idempotencyKey: command.idempotencyKey,
        clinicalContent: clone(command.correctedClinicalContent),
        occurredAt: requireTimestamp(clock),
        ids: ids(),
      }));
      return clone(outcome.result);
    },

    async transitionStatus(subject, rawCommand) {
      const actor = doctor(subject);
      const command = validateAsCommand(validatePrescriptionStatusCommand, rawCommand);
      if (command.ownerDoctorId !== actor.subjectId) throw failure(ERROR_CODES.NOT_FOUND);
      const outcome = confirmedRepository.transitionStatus(Object.freeze({
        ownerDoctorId: actor.subjectId,
        prescriptionId: command.prescriptionId,
        expectedResourceVersion: command.expectedResourceVersion,
        idempotencyKey: command.idempotencyKey,
        targetStatus: command.targetStatus,
        occurredAt: requireTimestamp(clock),
        ids: ids(),
      }));
      return clone(outcome.result);
    },

    getPrescription(subject, prescriptionId) {
      return clone(confirmedRepository.getByOwner(prescriptionId, doctor(subject).subjectId));
    },

    listPrescriptions(subject) {
      return clone(confirmedRepository.listByOwner(doctor(subject).subjectId));
    },

    listVersions(subject, prescriptionId) {
      return clone(confirmedRepository.listVersionsByOwner(prescriptionId, doctor(subject).subjectId));
    },

    listAudit(subject, prescriptionId) {
      return clone(confirmedRepository.listAuditByOwner(prescriptionId, doctor(subject).subjectId));
    },

    listStatusEvents(subject, prescriptionId) {
      return clone(confirmedRepository.listStatusEventsByOwner(prescriptionId, doctor(subject).subjectId));
    },
  });
}

export function createInMemoryConfirmedPrescriptionRepository() {
  const prescriptions = new Map();
  const versions = new Map();
  const audits = new Map();
  const statusEvents = new Map();
  const confirmedSessions = new Map();
  const idempotency = new Map();
  let serverVersion = 0;
  const usedIds = new Set();

  function owned(prescriptionId, ownerDoctorId) {
    const prescription = prescriptions.get(prescriptionId);
    if (prescription === undefined || prescription.ownerDoctorId !== ownerDoctorId) {
      throw failure(ERROR_CODES.NOT_FOUND);
    }
    return prescription;
  }

  function replay(ownerDoctorId, idempotencyKey, payload) {
    const key = `${ownerDoctorId}:${idempotencyKey}`;
    const existing = idempotency.get(key);
    if (existing === undefined) return null;
    if (existing.fingerprint !== fingerprint(payload)) throw failure(ERROR_CODES.IDEMPOTENCY_CONFLICT);
    return Object.freeze({ replayed: true, result: clone(existing.result) });
  }

  function remember(ownerDoctorId, idempotencyKey, payload, result) {
    idempotency.set(`${ownerDoctorId}:${idempotencyKey}`, Object.freeze({
      fingerprint: fingerprint(payload),
      result: clone(result),
    }));
    return Object.freeze({ replayed: false, result: clone(result) });
  }

  function audit({ ids, eventType, ownerDoctorId, occurredAt, prescriptionId, prescriptionVersion, previousPrescriptionVersion, resourceVersion }) {
    const record = {
      apiVersion: API_VERSION,
      schemaVersion: SCHEMA_VERSION,
      auditReferenceId: ids.auditReferenceId,
      eventType,
      outcome: "COMPLETED",
      actorDoctorId: ownerDoctorId,
      occurredAt,
      securityCorrelationId: ids.securityCorrelationId,
      prescriptionId,
      prescriptionVersion,
      previousPrescriptionVersion,
      resourceVersion,
    };
    return Object.freeze(validatePrescriptionAuditRecord(record));
  }

  function validateGeneratedIds(ids) {
    const values = Object.values(ids);
    if (values.some((value) => typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value))) {
      throw new TypeError("Generated identifiers must be opaque IDs");
    }
    if (new Set(values).size !== values.length || values.some((value) => usedIds.has(value))) throw failure(ERROR_CODES.CONFLICT);
  }

  function snapshot() {
    return { prescriptions: clone(prescriptions), versions: clone(versions), audits: clone(audits), statusEvents: clone(statusEvents), confirmedSessions: clone(confirmedSessions), idempotency: clone(idempotency), usedIds: clone(usedIds), serverVersion };
  }

  function restore(state) {
    for (const map of [prescriptions, versions, audits, statusEvents, confirmedSessions, idempotency]) map.clear();
    for (const [key, value] of state.prescriptions) prescriptions.set(key, value);
    for (const [key, value] of state.versions) versions.set(key, value);
    for (const [key, value] of state.audits) audits.set(key, value);
    for (const [key, value] of state.statusEvents) statusEvents.set(key, value);
    for (const [key, value] of state.confirmedSessions) confirmedSessions.set(key, value);
    for (const [key, value] of state.idempotency) idempotency.set(key, value);
    usedIds.clear();
    for (const value of state.usedIds) usedIds.add(value);
    serverVersion = state.serverVersion;
  }

  function append(map, key, value) {
    map.set(key, Object.freeze([...(map.get(key) ?? []), Object.freeze(clone(value))]));
  }

  return Object.freeze({
    replayConfirmation(input) {
      const payload = {
        operation: "CONFIRM",
        reviewSessionId: input.reviewSessionId,
        clinicalContent: input.clinicalContent,
      };
      const repeated = replay(input.ownerDoctorId, input.idempotencyKey, payload);
      return repeated === null ? null : clone(repeated.result);
    },

    prepareConfirmation(input) {
      const payload = {
        operation: "CONFIRM",
        reviewSessionId: input.reviewSessionId,
        clinicalContent: input.clinicalContent,
      };
      const repeated = replay(input.ownerDoctorId, input.idempotencyKey, payload);
      if (repeated !== null) return repeated;
      if (confirmedSessions.has(input.reviewSessionId)) throw failure(ERROR_CODES.CONFLICT);
      validateGeneratedIds(input.ids);

      const prescription = validateConfirmedPrescription({
        apiVersion: API_VERSION,
        schemaVersion: SCHEMA_VERSION,
        lifecycle: "DOCTOR_CONFIRMED",
        prescriptionId: input.ids.prescriptionId,
        ownerDoctorId: input.ownerDoctorId,
        patientAssociationId: null,
        status: "ACTIVE",
        currentPrescriptionVersion: 1,
        resourceVersion: 1,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      });
      const auditEvent = audit({
        ...input,
        eventType: "DOCTOR_CONFIRMATION",
        prescriptionId: prescription.prescriptionId,
        prescriptionVersion: 1,
        previousPrescriptionVersion: null,
        resourceVersion: 1,
      });
      const version = Object.freeze({
        ...validatePrescriptionVersion({
          apiVersion: API_VERSION,
          schemaVersion: SCHEMA_VERSION,
          lifecycle: "DOCTOR_CONFIRMED_VERSION",
          prescriptionId: prescription.prescriptionId,
          prescriptionVersion: 1,
          resourceVersion: 1,
          confirmedByDoctorId: input.ownerDoctorId,
          confirmedAt: input.occurredAt,
          createdAt: input.occurredAt,
          clinicalContent: clone(input.clinicalContent),
        }),
        previousPrescriptionVersion: null,
        auditReferenceId: auditEvent.auditReferenceId,
      });
      const result = Object.freeze({ prescription: clone(prescription), version: clone(version), audit: clone(auditEvent) });
      const before = snapshot();
      return Object.freeze({
        result: clone(result),
        commit() {
          prescriptions.set(prescription.prescriptionId, Object.freeze(clone(prescription)));
          versions.set(prescription.prescriptionId, Object.freeze([Object.freeze(clone(version))]));
          audits.set(prescription.prescriptionId, Object.freeze([auditEvent]));
          statusEvents.set(prescription.prescriptionId, Object.freeze([]));
          confirmedSessions.set(input.reviewSessionId, prescription.prescriptionId);
          for (const id of Object.values(input.ids)) usedIds.add(id);
          return remember(input.ownerDoctorId, input.idempotencyKey, payload, result);
        },
        rollback() { restore(before); },
      });
    },

    changeClinicalContent(input) {
      const payload = {
        operation: "CLINICAL_CHANGE",
        prescriptionId: input.prescriptionId,
        expectedResourceVersion: input.expectedResourceVersion,
        clinicalContent: input.clinicalContent,
      };
      const repeated = replay(input.ownerDoctorId, input.idempotencyKey, payload);
      if (repeated !== null) return repeated;
      const current = owned(input.prescriptionId, input.ownerDoctorId);
      validateGeneratedIds(input.ids);
      if (current.status === "CANCELLED") throw failure(ERROR_CODES.CONFLICT);
      if (current.resourceVersion !== input.expectedResourceVersion) throw failure(ERROR_CODES.STALE_RESOURCE_VERSION);

      const nextPrescriptionVersion = current.currentPrescriptionVersion + 1;
      const nextResourceVersion = current.resourceVersion + 1;
      const auditEvent = audit({
        ...input,
        eventType: "PRESCRIPTION_CLINICAL_CHANGE",
        prescriptionVersion: nextPrescriptionVersion,
        previousPrescriptionVersion: current.currentPrescriptionVersion,
        resourceVersion: nextResourceVersion,
      });
      const version = Object.freeze({
        ...validatePrescriptionVersion({
          apiVersion: API_VERSION,
          schemaVersion: SCHEMA_VERSION,
          lifecycle: "DOCTOR_CONFIRMED_VERSION",
          prescriptionId: current.prescriptionId,
          prescriptionVersion: nextPrescriptionVersion,
          resourceVersion: nextResourceVersion,
          confirmedByDoctorId: input.ownerDoctorId,
          confirmedAt: input.occurredAt,
          createdAt: input.occurredAt,
          clinicalContent: clone(input.clinicalContent),
        }),
        previousPrescriptionVersion: current.currentPrescriptionVersion,
        auditReferenceId: auditEvent.auditReferenceId,
      });
      const prescription = Object.freeze(validateConfirmedPrescription({
        ...clone(current),
        currentPrescriptionVersion: nextPrescriptionVersion,
        resourceVersion: nextResourceVersion,
        updatedAt: input.occurredAt,
      }));
      const result = Object.freeze({ prescription: clone(prescription), version: clone(version), audit: clone(auditEvent) });
      prescriptions.set(input.prescriptionId, prescription);
      append(versions, input.prescriptionId, version);
      append(audits, input.prescriptionId, auditEvent);
      for (const id of Object.values(input.ids)) usedIds.add(id);
      return remember(input.ownerDoctorId, input.idempotencyKey, payload, result);
    },

    transitionStatus(input) {
      const payload = {
        operation: "STATUS_CHANGE",
        prescriptionId: input.prescriptionId,
        expectedResourceVersion: input.expectedResourceVersion,
        targetStatus: input.targetStatus,
      };
      const repeated = replay(input.ownerDoctorId, input.idempotencyKey, payload);
      if (repeated !== null) return repeated;
      const current = owned(input.prescriptionId, input.ownerDoctorId);
      validateGeneratedIds(input.ids);
      if (current.resourceVersion !== input.expectedResourceVersion) throw failure(ERROR_CODES.STALE_RESOURCE_VERSION);
      const transition = `${current.status}->${input.targetStatus}`;
      if (!["ACTIVE->SUSPENDED", "ACTIVE->CANCELLED", "SUSPENDED->CANCELLED"].includes(transition)) {
        throw failure(ERROR_CODES.CONFLICT);
      }

      const nextResourceVersion = current.resourceVersion + 1;
      serverVersion += 1;
      const statusEvent = validatePrescriptionStatusEvent({
        apiVersion: API_VERSION,
        schemaVersion: SCHEMA_VERSION,
        eventId: input.ids.eventId,
        prescriptionId: current.prescriptionId,
        prescriptionVersion: current.currentPrescriptionVersion,
        previousStatus: current.status,
        status: input.targetStatus,
        resourceVersion: nextResourceVersion,
        serverVersion,
        occurredAt: input.occurredAt,
      });
      const auditEvent = audit({
        ...input,
        eventType: "PRESCRIPTION_STATUS_CHANGE",
        prescriptionVersion: current.currentPrescriptionVersion,
        previousPrescriptionVersion: null,
        resourceVersion: nextResourceVersion,
      });
      const prescription = Object.freeze(validateConfirmedPrescription({
        ...clone(current),
        status: input.targetStatus,
        resourceVersion: nextResourceVersion,
        updatedAt: input.occurredAt,
      }));
      const result = Object.freeze({ prescription: clone(prescription), statusEvent: clone(statusEvent), audit: clone(auditEvent) });
      prescriptions.set(input.prescriptionId, prescription);
      append(statusEvents, input.prescriptionId, statusEvent);
      append(audits, input.prescriptionId, auditEvent);
      for (const id of Object.values(input.ids)) usedIds.add(id);
      return remember(input.ownerDoctorId, input.idempotencyKey, payload, result);
    },

    getByOwner(prescriptionId, ownerDoctorId) {
      return clone(owned(prescriptionId, ownerDoctorId));
    },

    listByOwner(ownerDoctorId) {
      return [...prescriptions.values()].filter((item) => item.ownerDoctorId === ownerDoctorId).map(clone);
    },

    listVersionsByOwner(prescriptionId, ownerDoctorId) {
      owned(prescriptionId, ownerDoctorId);
      return clone(versions.get(prescriptionId) ?? []);
    },

    listAuditByOwner(prescriptionId, ownerDoctorId) {
      owned(prescriptionId, ownerDoctorId);
      return clone(audits.get(prescriptionId) ?? []);
    },

    listStatusEventsByOwner(prescriptionId, ownerDoctorId) {
      owned(prescriptionId, ownerDoctorId);
      return clone(statusEvents.get(prescriptionId) ?? []);
    },

    inspectForTests() {
      return clone({
        prescriptions: [...prescriptions.values()],
        versions: [...versions.values()].flat(),
        audits: [...audits.values()].flat(),
        statusEvents: [...statusEvents.values()].flat(),
      });
    },
  });
}
