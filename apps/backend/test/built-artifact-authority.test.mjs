import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

async function runtimeModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return runtimeModules(path);
    return entry.isFile() && entry.name.endsWith(".mjs") ? [path] : [];
  }));
  return nested.flat();
}

test("built backend exposes no subject-minting authority", async () => {
  const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = resolve(backendRoot, "../..");
  const build = spawnSync("npm", ["run", "build", "-w", "@medsup/backend"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const namespaces = [];
  for (const path of await runtimeModules(resolve(backendRoot, "dist"))) {
    namespaces.push({ path, namespace: await import(pathToFileURL(path)) });
  }

  const dangerousExports = [];
  for (const { path, namespace } of namespaces) {
    for (const exportName of Object.keys(namespace)) {
      if (/composition|register|mint|^authenticate|subject.*authenticate|provider.*factory|factory.*provider/i.test(exportName)) {
        dangerousExports.push(`${path}:${exportName}`);
      }
    }
  }

  let attackerSubjectAccepted = false;
  const composition = namespaces.find(({ namespace }) =>
    typeof namespace.createIdentityCompositionRoot === "function")?.namespace.createIdentityCompositionRoot;
  const roleGuard = namespaces.find(({ namespace }) =>
    typeof namespace.requireRole === "function")?.namespace.requireRole;
  if (composition && roleGuard) {
    const attackerIdentity = composition(Object.freeze({
      async authenticate() {
        return Object.freeze({ subjectId: "attacker-doctor", role: "doctor" });
      },
    }));
    const attackerSubject = await attackerIdentity.authenticate({ attackerControlled: true });
    attackerSubjectAccepted = roleGuard(attackerSubject, "doctor") === attackerSubject;
  }

  assert.deepEqual(
    { dangerousExports, attackerSubjectAccepted },
    { dangerousExports: [], attackerSubjectAccepted: false },
  );
});
