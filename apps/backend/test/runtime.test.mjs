import assert from "node:assert/strict";
import test from "node:test";
import { runtimeInfo } from "../src/runtime.mjs";

test("backend runtime identifies its environment", () => {
  assert.deepEqual(runtimeInfo("test"), { surface: "backend", environment: "test" });
});
