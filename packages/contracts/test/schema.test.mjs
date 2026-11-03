import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  ERROR_CODES,
  createErrorEnvelope,
  validateAuditReference,
  validateConfirmedPrescription,
  validateDoctorConfirmationCommand,
  validateEphemeralDocumentInput,
  validateErrorEnvelope,
  validatePrescriptionStatusCommand,
  validatePrescriptionStatusEvent,
  validatePrescriptionVersion,
  validateUntrustedPrescriptionProposal,
} from "../src/index.mjs";

const schemaUrl = new URL("../schemas/v1/contracts.schema.json", import.meta.url);

function assertNestedObjectsClosed(schema, path = "$") {
  if (schema === null || typeof schema !== "object") return;
  if (schema.type === "object") {
    assert.equal(schema.additionalProperties, false, `${path} must reject unknown fields`);
  }
  for (const [key, value] of Object.entries(schema)) {
    assertNestedObjectsClosed(value, `${path}/${key}`);
  }
}

async function loadSchemaValidator() {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  ajv.addSchema(schema);
  return { schema, ajv };
}

test("published v1 schemas are closed, versioned, and provider-neutral", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  assert.equal(schema.$id, "https://contracts.medsup.example/v1/contracts.schema.json");
  assert.deepEqual(
    Object.keys(schema.$defs).sort(),
    [
      "AuditReference",
      "ConfirmedPrescription",
      "DoctorConfirmationCommand",
      "EphemeralDocumentInput",
      "ErrorEnvelope",
      "PrescriptionStatusCommand",
      "PrescriptionStatusEvent",
      "PrescriptionVersion",
      "UntrustedPrescriptionProposal",
    ].sort(),
  );
  assertNestedObjectsClosed(schema);
  const source = JSON.stringify(schema).toLowerCase();
  for (const forbidden of [
    "storagekey",
    "repositoryid",
    "recoverytoken",
    "rawocr",
    "providerpayload",
    "localstorage",
    "analytics",
    "tracefield",
    "sem_confirmacao",
    "tomada",
    "adiada",
    "dispensada",
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden field found: ${forbidden}`);
  }
});

test("schema fixtures match executable validators for every published contract", async () => {
  const { schema, ajv } = await loadSchemaValidator();
  const reviewSessionId = "rvs_01JBR4N9V2Q8K6M3F7X5T1C0AZ";
  const doctorId = "doc_01JBR5V9A7E2K8N4Q6M0T3X1CZ";
  const prescriptionId = "rx_01JBR67EDW4A9T2N8M5KQ3X0CZ";
  const clinicalContent = { medications: [{ medicationName: "Example medicine", dose: "1 tablet" }] };
  const fixtures = {
    EphemeralDocumentInput: [{ apiVersion: "v1", schemaVersion: 1, reviewSessionId, mediaType: "application/pdf", byteLength: 2048 }, validateEphemeralDocumentInput],
    UntrustedPrescriptionProposal: [{ apiVersion: "v1", schemaVersion: 1, lifecycle: "SESSION_ONLY_UNTRUSTED", reviewSessionId, generatedAt: "2026-11-03T15:45:00Z", expiresAt: "2026-11-03T16:00:00Z", clinicalContent }, validateUntrustedPrescriptionProposal],
    DoctorConfirmationCommand: [{ apiVersion: "v1", schemaVersion: 1, idempotencyKey: "idem_01JBR5R0TDJXM8V4NX6KQ2P9AZ", reviewSessionId, ownerDoctorId: doctorId, confirmation: { decision: "CONFIRMED", confirmedByDoctorId: doctorId, confirmedAt: "2026-11-03T15:50:00Z" }, correctedClinicalContent: clinicalContent }, validateDoctorConfirmationCommand],
    ConfirmedPrescription: [{ apiVersion: "v1", schemaVersion: 1, lifecycle: "DOCTOR_CONFIRMED", prescriptionId, ownerDoctorId: doctorId, patientAssociationId: null, status: "ACTIVE", currentPrescriptionVersion: 1, resourceVersion: 1, createdAt: "2026-11-03T15:50:00Z", updatedAt: "2026-11-03T15:50:00Z" }, validateConfirmedPrescription],
    PrescriptionVersion: [{ apiVersion: "v1", schemaVersion: 1, lifecycle: "DOCTOR_CONFIRMED_VERSION", prescriptionId, prescriptionVersion: 1, resourceVersion: 1, confirmedByDoctorId: doctorId, confirmedAt: "2026-11-03T15:50:00Z", createdAt: "2026-11-03T15:50:00Z", clinicalContent }, validatePrescriptionVersion],
    PrescriptionStatusCommand: [{ apiVersion: "v1", schemaVersion: 1, idempotencyKey: "idem_01JBR6D8P4N7X2K9M5Q0T3V1AZ", prescriptionId, ownerDoctorId: doctorId, expectedResourceVersion: 1, targetStatus: "SUSPENDED", requestedAt: "2026-11-03T16:00:00Z" }, validatePrescriptionStatusCommand],
    PrescriptionStatusEvent: [{ apiVersion: "v1", schemaVersion: 1, eventId: "evt_01JBR6G2X8M4K7N1Q5T9V3P0AZ", prescriptionId, prescriptionVersion: 1, previousStatus: "ACTIVE", status: "SUSPENDED", resourceVersion: 2, serverVersion: 42, occurredAt: "2026-11-03T16:00:01Z" }, validatePrescriptionStatusEvent],
    AuditReference: [{ apiVersion: "v1", schemaVersion: 1, auditReferenceId: "aud_01JBR6PK2M8V4X7N1Q5T9C3AZ", eventType: "EPHEMERAL_EXTRACTION", outcome: "COMPLETED", occurredAt: "2026-11-03T16:01:00Z", securityCorrelationId: "cor_01JBR6Q8N4M2X7K5T9V1P3AZ" }, validateAuditReference],
    ErrorEnvelope: [createErrorEnvelope("INTERNAL_ERROR", "req_01JBR6V2N8M4X7K5T9Q1P3AZ"), validateErrorEnvelope],
  };

  for (const [definition, [fixture, validateRuntime]] of Object.entries(fixtures)) {
    const validateSchema = ajv.getSchema(`${schema.$id}#/$defs/${definition}`);
    assert.equal(typeof validateSchema, "function");
    assert.equal(validateSchema(fixture), true, `${definition}: ${ajv.errorsText(validateSchema.errors)}`);
    assert.equal(validateRuntime(fixture), fixture);

    const unknown = { ...fixture, rawOcr: "sensitive" };
    assert.equal(validateSchema(unknown), false, `${definition} accepted an unknown field`);
    assert.throws(() => validateRuntime(unknown), `${definition} runtime accepted an unknown field`);
  }

  for (const definition of ["UntrustedPrescriptionProposal", "DoctorConfirmationCommand", "PrescriptionVersion"]) {
    const [fixture, validateRuntime] = fixtures[definition];
    const clinicalKey = definition === "DoctorConfirmationCommand" ? "correctedClinicalContent" : "clinicalContent";
    const whitespace = {
      ...fixture,
      [clinicalKey]: { medications: [{ medicationName: "   ", dose: "1 tablet" }] },
    };
    const validateSchema = ajv.getSchema(`${schema.$id}#/$defs/${definition}`);
    assert.equal(validateSchema(whitespace), false, `${definition} schema accepted whitespace-only clinical text`);
    assert.throws(() => validateRuntime(whitespace));
  }

  const nestedUnknowns = [
    ["UntrustedPrescriptionProposal", { ...fixtures.UntrustedPrescriptionProposal[0], clinicalContent: { ...clinicalContent, rawOcr: "sensitive" } }],
    ["PrescriptionVersion", { ...fixtures.PrescriptionVersion[0], clinicalContent: { medications: [{ ...clinicalContent.medications[0], proposal: "sensitive" }] } }],
    ["DoctorConfirmationCommand", { ...fixtures.DoctorConfirmationCommand[0], confirmation: { ...fixtures.DoctorConfirmationCommand[0].confirmation, identity: "sensitive" } }],
    ["ErrorEnvelope", { ...fixtures.ErrorEnvelope[0], error: { ...fixtures.ErrorEnvelope[0].error, diagnostic: "sensitive" } }],
  ];
  for (const [definition, fixture] of nestedUnknowns) {
    const validateSchema = ajv.getSchema(`${schema.$id}#/$defs/${definition}`);
    assert.equal(validateSchema(fixture), false, `${definition} accepted a nested unknown field`);
    assert.throws(() => fixtures[definition][1](fixture), `${definition} runtime accepted a nested unknown field`);
  }
});

test("error schema accepts exactly every canonical runtime tuple", async () => {
  const { schema, ajv } = await loadSchemaValidator();
  const validateSchema = ajv.getSchema(`${schema.$id}#/$defs/ErrorEnvelope`);
  assert.equal(typeof validateSchema, "function");
  const requestId = "req_01JBR6V2N8M4X7K5T9Q1P3AZ";

  for (const code of Object.values(ERROR_CODES)) {
    const canonical = createErrorEnvelope(code, requestId);
    assert.equal(validateSchema(canonical), true, `${code}: ${ajv.errorsText(validateSchema.errors)}`);
    assert.equal(validateErrorEnvelope(canonical), canonical);

    for (const invalid of [
      { ...canonical, error: { ...canonical.error, message: "raw OCR patient medication dose" } },
      { ...canonical, error: { ...canonical.error, retryable: !canonical.error.retryable } },
    ]) {
      assert.equal(validateSchema(invalid), false, `${code} accepted an incompatible tuple`);
      assert.throws(() => validateErrorEnvelope(invalid));
    }
  }
});
