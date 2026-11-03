import assert from "node:assert/strict";
import test from "node:test";
import { foundationMetadata } from "../src/foundation.mjs";

test("PWA foundation declares no browser persistence", () => {
  assert.deepEqual(foundationMetadata(), { surface: "doctor-pwa", persistence: "none" });
});
