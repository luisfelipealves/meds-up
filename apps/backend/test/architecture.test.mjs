import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const architecture = new URL("../../../docs/architecture/README.md", import.meta.url);

test("backend architecture defines replaceable service boundaries", async () => {
  const text = await readFile(architecture, "utf8");
  for (const boundary of ["IdentityPort", "ConfirmedPrescriptionRepository", "EphemeralExtractionPort", "KeyManagementPort", "NotificationPort"]) {
    assert.match(text, new RegExp(`\\b${boundary}\\b`));
  }
});
