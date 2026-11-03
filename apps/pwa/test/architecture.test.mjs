import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = new URL("../src/foundation.mjs", import.meta.url);
const html = new URL("../src/index.html", import.meta.url);

test("PWA foundation has no browser persistence or service worker", async () => {
  const text = `${await readFile(source, "utf8")}\n${await readFile(html, "utf8")}`;
  for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "caches.open", "serviceWorker.register"]) {
    assert.equal(text.includes(forbidden), false, `forbidden browser persistence: ${forbidden}`);
  }
});
