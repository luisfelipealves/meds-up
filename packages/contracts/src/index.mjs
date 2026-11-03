export const API_VERSION = "v1";
export const SCHEMA_VERSION = 1;

export const ROLES = Object.freeze({
  DOCTOR: "doctor",
  PATIENT: "patient"
});

export const ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  STALE_RESOURCE_VERSION: "STALE_RESOURCE_VERSION",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  UNSUPPORTED_API_VERSION: "UNSUPPORTED_API_VERSION",
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  INVALID_AUTHENTICATED_SUBJECT: "INVALID_AUTHENTICATED_SUBJECT",
  ROLE_FORBIDDEN: "ROLE_FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_REVOKED: "SESSION_REVOKED",
  DEVICE_REVOKED: "DEVICE_REVOKED",
  INTERNAL_ERROR: "INTERNAL_ERROR"
});

const ERROR_DEFINITIONS = Object.freeze({
  VALIDATION_FAILED: ["The request is invalid.", false],
  UNAUTHORIZED: ["The request is not authorized.", false],
  NOT_FOUND: ["The resource was not found.", false],
  CONFLICT: ["The request conflicts with the resource state.", false],
  STALE_RESOURCE_VERSION: ["The resource changed; refresh and retry.", true],
  IDEMPOTENCY_CONFLICT: ["The idempotency key was already used for another request.", false],
  UNSUPPORTED_API_VERSION: ["The API version is not supported.", false],
  AUTHENTICATION_FAILED: ["Authentication failed.", false],
  INVALID_AUTHENTICATED_SUBJECT: ["The authenticated subject is invalid.", false],
  ROLE_FORBIDDEN: ["The authenticated role is not permitted.", false],
  SESSION_EXPIRED: ["The session has expired.", false],
  SESSION_REVOKED: ["The session is not active.", false],
  DEVICE_REVOKED: ["The device is not authorized to synchronize.", false],
  INTERNAL_ERROR: ["The request could not be completed.", true]
});

export class ContractValidationError extends Error {
  constructor(contract, issues) {
    super(`Invalid ${contract} contract`);
    this.name = "ContractValidationError";
    this.contract = contract;
    this.issues = issues;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateObject(contract, value, fields) {
  const issues = [];
  if (!isRecord(value)) {
    throw new ContractValidationError(contract, [{ path: "$", code: "TYPE", message: "must be an object" }]);
  }

  for (const key of Object.keys(value)) {
    if (!(key in fields)) {
      issues.push({ path: key, code: "UNKNOWN_FIELD", message: "field is not allowed" });
    }
  }
  for (const [key, check] of Object.entries(fields)) {
    if (!(key in value)) {
      issues.push({ path: key, code: "REQUIRED", message: "field is required" });
    } else if (!check(value[key])) {
      issues.push({ path: key, code: "INVALID", message: "field has an invalid value" });
    }
  }
  if (issues.length > 0) {
    throw new ContractValidationError(contract, issues);
  }
  return value;
}

const isOpaqueId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isTimestamp = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value));
const hasOnlyKeys = (value, allowed) => isRecord(value)
  && Object.keys(value).every((key) => allowed.includes(key));
const isClinicalContent = (value) => hasOnlyKeys(value, ["medications"])
  && Array.isArray(value.medications)
  && value.medications.length > 0
  && value.medications.every((medication) => hasOnlyKeys(medication, ["medicationName", "dose"])
    && typeof medication.medicationName === "string"
    && medication.medicationName.trim().length > 0
    && typeof medication.dose === "string"
    && medication.dose.trim().length > 0);
const isIdempotencyKey = (value) => typeof value === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(value);
const isExplicitConfirmation = (value) => hasOnlyKeys(value, ["decision", "confirmedByDoctorId", "confirmedAt"])
  && value.decision === "CONFIRMED"
  && isOpaqueId(value.confirmedByDoctorId)
  && isTimestamp(value.confirmedAt);

export function validateEphemeralDocumentInput(value) {
  return validateObject("EphemeralDocumentInput", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    reviewSessionId: isOpaqueId,
    mediaType: (candidate) => ["application/pdf", "image/jpeg", "image/png"].includes(candidate),
    byteLength: isPositiveInteger
  });
}

export function validateUntrustedPrescriptionProposal(value) {
  const proposal = validateObject("UntrustedPrescriptionProposal", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    lifecycle: (candidate) => candidate === "SESSION_ONLY_UNTRUSTED",
    reviewSessionId: isOpaqueId,
    generatedAt: isTimestamp,
    expiresAt: isTimestamp,
    clinicalContent: isClinicalContent
  });
  if (Date.parse(proposal.expiresAt) <= Date.parse(proposal.generatedAt)) {
    throw new ContractValidationError("UntrustedPrescriptionProposal", [
      { path: "expiresAt", code: "INVALID", message: "must be after generatedAt" }
    ]);
  }
  return proposal;
}

export function validateDoctorConfirmationCommand(value) {
  const command = validateObject("DoctorConfirmationCommand", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    idempotencyKey: isIdempotencyKey,
    reviewSessionId: isOpaqueId,
    ownerDoctorId: isOpaqueId,
    confirmation: isExplicitConfirmation,
    correctedClinicalContent: isClinicalContent
  });
  if (command.ownerDoctorId !== command.confirmation.confirmedByDoctorId) {
    throw new ContractValidationError("DoctorConfirmationCommand", [
      { path: "confirmation.confirmedByDoctorId", code: "OWNER_MISMATCH", message: "must match ownerDoctorId" }
    ]);
  }
  return command;
}

export function validateConfirmedPrescription(value) {
  const prescription = validateObject("ConfirmedPrescription", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    lifecycle: (candidate) => candidate === "DOCTOR_CONFIRMED",
    prescriptionId: isOpaqueId,
    ownerDoctorId: isOpaqueId,
    patientAssociationId: (candidate) => candidate === null || isOpaqueId(candidate),
    status: (candidate) => ["ACTIVE", "SUSPENDED", "CANCELLED"].includes(candidate),
    currentPrescriptionVersion: isPositiveInteger,
    resourceVersion: isPositiveInteger,
    createdAt: isTimestamp,
    updatedAt: isTimestamp
  });
  if (Date.parse(prescription.updatedAt) < Date.parse(prescription.createdAt)) {
    throw new ContractValidationError("ConfirmedPrescription", [
      { path: "updatedAt", code: "INVALID", message: "must not precede createdAt" }
    ]);
  }
  return prescription;
}

export function validatePrescriptionVersion(value) {
  return validateObject("PrescriptionVersion", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    lifecycle: (candidate) => candidate === "DOCTOR_CONFIRMED_VERSION",
    prescriptionId: isOpaqueId,
    prescriptionVersion: isPositiveInteger,
    resourceVersion: isPositiveInteger,
    confirmedByDoctorId: isOpaqueId,
    confirmedAt: isTimestamp,
    createdAt: isTimestamp,
    clinicalContent: isClinicalContent
  });
}

export function validatePrescriptionStatusCommand(value) {
  return validateObject("PrescriptionStatusCommand", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    idempotencyKey: isIdempotencyKey,
    prescriptionId: isOpaqueId,
    ownerDoctorId: isOpaqueId,
    expectedResourceVersion: isPositiveInteger,
    targetStatus: (candidate) => ["SUSPENDED", "CANCELLED"].includes(candidate),
    requestedAt: isTimestamp
  });
}

export function validatePrescriptionStatusEvent(value) {
  const event = validateObject("PrescriptionStatusEvent", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    eventId: isOpaqueId,
    prescriptionId: isOpaqueId,
    prescriptionVersion: isPositiveInteger,
    previousStatus: (candidate) => ["ACTIVE", "SUSPENDED"].includes(candidate),
    status: (candidate) => ["SUSPENDED", "CANCELLED"].includes(candidate),
    resourceVersion: (candidate) => isPositiveInteger(candidate) && candidate > 1,
    serverVersion: isPositiveInteger,
    occurredAt: isTimestamp
  });
  const transition = `${event.previousStatus}->${event.status}`;
  if (!["ACTIVE->SUSPENDED", "ACTIVE->CANCELLED", "SUSPENDED->CANCELLED"].includes(transition)) {
    throw new ContractValidationError("PrescriptionStatusEvent", [
      { path: "status", code: "INVALID_TRANSITION", message: `transition ${transition} is not allowed` }
    ]);
  }
  return event;
}

export function serializeContract(value, validator) {
  return JSON.stringify(validator(value));
}

export function prescriptionVersionPath(prescriptionId, prescriptionVersion) {
  if (!isOpaqueId(prescriptionId) || !isPositiveInteger(prescriptionVersion)) {
    throw new ContractValidationError("PrescriptionVersionPath", [
      { path: "$", code: "INVALID", message: "requires an opaque prescription ID and positive version" }
    ]);
  }
  return `/${API_VERSION}/prescriptions/${prescriptionId}/versions/${prescriptionVersion}`;
}

export function parsePrescriptionVersionResponse(serialized) {
  let response;
  try {
    response = JSON.parse(serialized);
  } catch {
    throw new ContractValidationError("PrescriptionVersionResponse", [
      { path: "$", code: "INVALID_JSON", message: "must be valid JSON" }
    ]);
  }
  if (!isRecord(response) || response.apiVersion !== API_VERSION || !isRecord(response.data)) {
    throw new ContractValidationError("PrescriptionVersionResponse", [
      { path: "$", code: "INVALID", message: "must contain v1 data" }
    ]);
  }
  const data = response.data;
  const medications = data.clinicalContent?.medications;
  const compatible = {
    apiVersion: data.apiVersion,
    schemaVersion: data.schemaVersion,
    lifecycle: data.lifecycle,
    prescriptionId: data.prescriptionId,
    prescriptionVersion: data.prescriptionVersion,
    resourceVersion: data.resourceVersion,
    confirmedByDoctorId: data.confirmedByDoctorId,
    confirmedAt: data.confirmedAt,
    createdAt: data.createdAt,
    clinicalContent: {
      medications: Array.isArray(medications)
        ? medications.map((item) => ({ medicationName: item?.medicationName, dose: item?.dose }))
        : medications
    }
  };
  return validatePrescriptionVersion(compatible);
}

export function validateAuditReference(value) {
  return validateObject("AuditReference", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    schemaVersion: (candidate) => candidate === SCHEMA_VERSION,
    auditReferenceId: isOpaqueId,
    eventType: (candidate) => ["EPHEMERAL_EXTRACTION", "DOCTOR_CONFIRMATION", "PRESCRIPTION_STATUS_CHANGE"].includes(candidate),
    outcome: (candidate) => ["STARTED", "COMPLETED", "FAILED", "DENIED"].includes(candidate),
    occurredAt: isTimestamp,
    securityCorrelationId: isOpaqueId
  });
}

export function validateErrorEnvelope(value) {
  return validateObject("ErrorEnvelope", value, {
    apiVersion: (candidate) => candidate === API_VERSION,
    error: (candidate) => {
      if (!hasOnlyKeys(candidate, ["code", "message", "requestId", "retryable"]) || !isOpaqueId(candidate.requestId)) {
        return false;
      }
      const definition = ERROR_DEFINITIONS[candidate.code];
      return definition !== undefined
        && candidate.message === definition[0]
        && candidate.retryable === definition[1];
    }
  });
}

export function createErrorEnvelope(code, requestId) {
  const definition = ERROR_DEFINITIONS[code];
  if (definition === undefined) {
    throw new ContractValidationError("ErrorEnvelope", [
      { path: "error.code", code: "INVALID", message: "error code is not allow-listed" }
    ]);
  }
  return validateErrorEnvelope({
    apiVersion: API_VERSION,
    error: { code, message: definition[0], requestId, retryable: definition[1] }
  });
}
