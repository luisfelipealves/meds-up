import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const surface = process.argv[2];
if (!new Set(["backend", "pwa"]).has(surface)) {
  throw new Error("usage: build-node-surface.mjs <backend|pwa>");
}

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "apps", surface, "src");
const destination = resolve(root, "apps", surface, "dist");
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`built ${surface} -> ${destination}`);
