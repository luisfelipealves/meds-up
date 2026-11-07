import assert from "node:assert/strict";
import test from "node:test";

import {
  ContractValidationError,
  validateEphemeralDocumentInput,
  validateUntrustedPrescriptionProposal,
  validateDoctorConfirmationCommand,
  validatePrescriptionClinicalChangeCommand,
  validateConfirmedPrescription,
  validatePrescriptionVersion,
  validatePrescriptionStatusCommand,
  validatePrescriptionStatusEvent,
  serializeContract,
  parsePrescriptionVersionResponse,
  prescriptionVersionPath,
  validateAuditReference,
  createErrorEnvelope,
  validateErrorEnvelope
} from "../src/index.mjs";

const validInput = {
  apiVersion: "v1",
  schemaVersion: 1,
  reviewSessionId: "rvs_01JBR4N9V2Q8K6M3F7X5T1C0AZ",
  mediaType: "application/pdf",
  byteLength: 2048
};

test("ephemeral document input accepts request metadata without a storage or recovery locator", () => {
  assert.deepEqual(validateEphemeralDocumentInput(validInput), validInput);
});

test("ephemeral document input rejects persistence and recovery fields", () => {
  for (const forbidden of ["url", "storageKey", "repositoryId", "filename", "rawOcr", "documentBase64"]) {
    assert.throws(
      () => validateEphemeralDocumentInput({ ...validInput, [forbidden]: "forbidden" }),
      (error) => error instanceof ContractValidationError && error.issues.some((issue) => issue.path === forbidden)
    );
  }
});

const validProposal = {
  apiVersion: "v1",
  schemaVersion: 1,
  lifecycle: "SESSION_ONLY_UNTRUSTED",
  reviewSessionId: validInput.reviewSessionId,
  generatedAt: "2026-11-03T15:45:00Z",
  expiresAt: "2026-11-03T16:00:00Z",
  provenance: { source: "OCR_AI_EXTRACTION", scope: "SESSION_ONLY" },
  confidence: { overall: 0.85 },
  clinicalContent: {
    medications: [{ medicationName: "Example medicine", dose: "1 tablet" }]
  }
};

test("proposal remains explicitly untrusted and session-only", () => {
  assert.deepEqual(validateUntrustedPrescriptionProposal(validProposal), validProposal);
  for (const forbidden of ["prescriptionId", "confirmedAt", "confirmedByDoctorId", "storageKey", "recoveryToken", "rawProviderResponse"]) {
    assert.throws(() => validateUntrustedPrescriptionProposal({ ...validProposal, [forbidden]: "forbidden" }), ContractValidationError);
  }
});

test("proposal requires closed session-only provenance and bounded confidence", () => {
  assert.throws(() => validateUntrustedPrescriptionProposal({ ...validProposal, provenance: { source: "OCR_AI_EXTRACTION", scope: "DURABLE" } }), ContractValidationError);
  assert.throws(() => validateUntrustedPrescriptionProposal({ ...validProposal, confidence: { overall: 1.01 } }), ContractValidationError);
  assert.throws(() => validateUntrustedPrescriptionProposal({ ...validProposal, confidence: { overall: 0.5, raw: "forbidden" } }), ContractValidationError);
});

const validConfirmation = {
  apiVersion: "v1",
  schemaVersion: 1,
  idempotencyKey: "idem_01JBR5R0TDJXM8V4NX6KQ2P9AZ",
  reviewSessionId: validInput.reviewSessionId,
  ownerDoctorId: "doc_01JBR5V9A7E2K8N4Q6M0T3X1CZ",
  confirmation: {
    decision: "CONFIRMED",
    confirmedByDoctorId: "doc_01JBR5V9A7E2K8N4Q6M0T3X1CZ",
    confirmedAt: "2026-11-03T15:50:00Z"
  },
  correctedClinicalContent: validProposal.clinicalContent
};

test("only an explicit doctor confirmation command can represent confirmation", () => {
  assert.deepEqual(validateDoctorConfirmationCommand(validConfirmation), validConfirmation);
  assert.throws(
    () => validateDoctorConfirmationCommand({
      ...validConfirmation,
      confirmation: { ...validConfirmation.confirmation, decision: "PROPOSED" }
    }),
    ContractValidationError
  );
});

test("clinical change command requires explicit doctor confirmation and optimistic concurrency", () => {
  const command = {
    apiVersion: "v1",
    schemaVersion: 1,
    idempotencyKey: "idem_change_00000000000001",
    prescriptionId: "rx_01JBR67EDW4A9T2N8M5KQ3X0CZ",
    ownerDoctorId: validConfirmation.ownerDoctorId,
    expectedResourceVersion: 1,
    confirmation: validConfirmation.confirmation,
    correctedClinicalContent: validProposal.clinicalContent
  };
  assert.deepEqual(validatePrescriptionClinicalChangeCommand(command), command);
  assert.throws(
    () => validatePrescriptionClinicalChangeCommand({ ...command, expectedResourceVersion: 0 }),
    ContractValidationError
  );
  assert.throws(
    () => validatePrescriptionClinicalChangeCommand({ ...command, confirmation: { ...command.confirmation, decision: "PROPOSED" } }),
    ContractValidationError
  );
});

const validPrescription = {
  apiVersion: "v1",
  schemaVersion: 1,
  lifecycle: "DOCTOR_CONFIRMED",
  prescriptionId: "rx_01JBR67EDW4A9T2N8M5KQ3X0CZ",
  ownerDoctorId: validConfirmation.ownerDoctorId,
  patientAssociationId: null,
  status: "ACTIVE",
  currentPrescriptionVersion: 1,
  resourceVersion: 1,
  createdAt: "2026-11-03T15:50:00Z",
  updatedAt: "2026-11-03T15:50:00Z"
};

const validVersion = {
  apiVersion: "v1",
  schemaVersion: 1,
  lifecycle: "DOCTOR_CONFIRMED_VERSION",
  prescriptionId: validPrescription.prescriptionId,
  prescriptionVersion: 1,
  resourceVersion: 1,
  confirmedByDoctorId: validConfirmation.ownerDoctorId,
  confirmedAt: validConfirmation.confirmation.confirmedAt,
  createdAt: "2026-11-03T15:50:00Z",
  clinicalContent: validProposal.clinicalContent
};

test("confirmed prescription and immutable version expose ownership, status, and explicit versions", () => {
  assert.deepEqual(validateConfirmedPrescription(validPrescription), validPrescription);
  assert.deepEqual(validatePrescriptionVersion(validVersion), validVersion);
  assert.throws(() => validateConfirmedPrescription({ ...validPrescription, lifecycle: "SESSION_ONLY_UNTRUSTED" }), ContractValidationError);
  assert.throws(() => validatePrescriptionVersion({ ...validVersion, confirmedByDoctorId: undefined }), ContractValidationError);
});

const validStatusCommand = {
  apiVersion: "v1",
  schemaVersion: 1,
  idempotencyKey: "idem_01JBR6D8P4N7X2K9M5Q0T3V1AZ",
  prescriptionId: validPrescription.prescriptionId,
  ownerDoctorId: validPrescription.ownerDoctorId,
  expectedResourceVersion: 1,
  targetStatus: "SUSPENDED",
  requestedAt: "2026-11-03T16:00:00Z"
};

const validStatusEvent = {
  apiVersion: "v1",
  schemaVersion: 1,
  eventId: "evt_01JBR6G2X8M4K7N1Q5T9V3P0AZ",
  prescriptionId: validPrescription.prescriptionId,
  prescriptionVersion: 1,
  previousStatus: "ACTIVE",
  status: "SUSPENDED",
  resourceVersion: 2,
  serverVersion: 42,
  occurredAt: "2026-11-03T16:00:01Z"
};

test("idempotent status contracts support suspension and cancellation with monotonic versions", () => {
  assert.deepEqual(validatePrescriptionStatusCommand(validStatusCommand), validStatusCommand);
  assert.deepEqual(validatePrescriptionStatusEvent(validStatusEvent), validStatusEvent);
  assert.deepEqual(
    validatePrescriptionStatusCommand({ ...validStatusCommand, targetStatus: "CANCELLED" }).targetStatus,
    "CANCELLED"
  );
  assert.throws(
    () => validatePrescriptionStatusEvent({ ...validStatusEvent, previousStatus: "CANCELLED", status: "ACTIVE" }),
    ContractValidationError
  );
});

test("version retrieval is major-versioned and tolerates additive response fields", () => {
  const response = {
    apiVersion: "v1",
    data: {
      ...validVersion,
      futureAdditiveField: "ignored",
      clinicalContent: {
        ...validVersion.clinicalContent,
        futureAdditiveField: "ignored",
        medications: validVersion.clinicalContent.medications.map((item) => ({ ...item, futureAdditiveField: "ignored" }))
      }
    },
    futureEnvelopeField: "ignored"
  };
  assert.equal(prescriptionVersionPath(validVersion.prescriptionId, 1), `/v1/prescriptions/${validVersion.prescriptionId}/versions/1`);
  assert.deepEqual(parsePrescriptionVersionResponse(JSON.stringify(response)), validVersion);
  assert.equal(serializeContract(validVersion, validatePrescriptionVersion), JSON.stringify(validVersion));
});

test("audit references are minimal and non-clinical", () => {
  const reference = {
    apiVersion: "v1",
    schemaVersion: 1,
    auditReferenceId: "aud_01JBR6PK2M8V4X7N1Q5T9C3AZ",
    eventType: "EPHEMERAL_EXTRACTION",
    outcome: "COMPLETED",
    occurredAt: "2026-11-03T16:01:00Z",
    securityCorrelationId: "cor_01JBR6Q8N4M2X7K5T9V1P3AZ"
  };
  assert.deepEqual(validateAuditReference(reference), reference);
  for (const forbidden of ["filename", "document", "ocrText", "clinicalContent", "providerPayload", "proposal"]) {
    assert.throws(() => validateAuditReference({ ...reference, [forbidden]: "forbidden" }), ContractValidationError);
  }
});

test("error envelope is stable, allow-listed, and content-free", () => {
  const envelope = createErrorEnvelope("STALE_RESOURCE_VERSION", "req_01JBR6V2N8M4X7K5T9Q1P3AZ");
  assert.deepEqual(envelope, {
    apiVersion: "v1",
    error: {
      code: "STALE_RESOURCE_VERSION",
      message: "The resource changed; refresh and retry.",
      requestId: "req_01JBR6V2N8M4X7K5T9Q1P3AZ",
      retryable: true
    }
  });
  assert.deepEqual(validateErrorEnvelope(envelope), envelope);
  assert.throws(() => validateErrorEnvelope({ ...envelope, rawProviderResponse: "forbidden" }), ContractValidationError);
});
