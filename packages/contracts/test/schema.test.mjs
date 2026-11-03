import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../schemas/v1/contracts.schema.json", import.meta.url);

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
      "UntrustedPrescriptionProposal"
    ].sort()
  );
  for (const definition of Object.values(schema.$defs)) {
    assert.equal(definition.additionalProperties, false);
  }
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
    "dispensada"
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden field found: ${forbidden}`);
  }
});
