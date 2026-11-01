import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "apps/backend/package.json",
  "apps/pwa/package.json",
  "apps/android/build.gradle.kts",
  "apps/wear/build.gradle.kts",
  "docs/architecture/README.md",
  "docs/architecture/adr/0001-platform-and-repository-structure.md",
  "docs/architecture/adr/0002-health-data-and-ephemeral-processing.md",
  "docs/architecture/adr/0003-api-compatibility.md",
  "docs/architecture/adr/0004-eu-deployment-and-provider-boundaries.md",
  ".env.example"
];

for (const path of required) {
  await readFile(resolve(root, path));
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return nested.flat();
}

const runtimeRoots = [
  "apps/backend/src",
  "apps/pwa/src",
  "apps/android/src/main",
  "apps/wear/src/main"
];
const files = (await Promise.all(runtimeRoots.map((path) => sourceFiles(resolve(root, path))))).flat();
const source = (await Promise.all(files
  .filter((path) => [".html", ".java", ".js", ".json", ".kt", ".mjs", ".xml"].includes(extname(path)))
  .map((path) => readFile(path, "utf8")))).join("\n");

const forbiddenRuntimeMechanisms = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "serviceWorker.register",
  "caches.open",
  "DocumentBucket",
  "OcrQueue"
];
for (const forbidden of forbiddenRuntimeMechanisms) {
  assert.equal(source.includes(forbidden), false, `forbidden runtime mechanism found: ${forbidden}`);
}

const gitignore = await readFile(resolve(root, ".gitignore"), "utf8");
assert.match(gitignore, /^\.env$/m);
assert.match(gitignore, /^local\.properties$/m);

console.log(`foundation static check passed (${required.length} required files, ${files.length} runtime files)`);
