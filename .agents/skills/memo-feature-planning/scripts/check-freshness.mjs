#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillRoot = resolve(scriptDir, "..");
const repoRoot = resolve(skillRoot, "../../..");
const manifestPath = resolve(skillRoot, "references/freshness-manifest.json");

function hashFile(path) {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

if (!existsSync(manifestPath)) {
  console.error(
    "missing freshness manifest: .agents/skills/memo-feature-planning/references/freshness-manifest.json",
  );
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];
const rows = [];

for (const entry of manifest.files ?? []) {
  if (
    entry.path ===
    ".agents/skills/memo-feature-planning/references/freshness-manifest.json"
  ) {
    failures.push(`${entry.path}: manifest must not watch itself`);
    continue;
  }
  const absolute = resolve(repoRoot, entry.path);
  if (!existsSync(absolute)) {
    rows.push({ path: entry.path, status: "missing" });
    if (entry.required !== false) failures.push(`${entry.path}: missing`);
    continue;
  }
  const actual = hashFile(absolute);
  const status = actual === entry.sha256 ? "clean" : "stale";
  rows.push({ path: entry.path, status });
  if (status !== "clean" && entry.required !== false) {
    failures.push(`${entry.path}: stale`);
  }
}

for (const row of rows) {
  console.log(`${row.status.padEnd(7)} ${row.path}`);
}

if (failures.length > 0) {
  console.error("");
  console.error("Freshness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("");
  console.error(
    "Refresh guidance: re-read stale or missing inputs, update references/templates/scripts as needed, then regenerate freshness-manifest.json.",
  );
  process.exit(1);
}

console.log("");
console.log(`Freshness check clean for ${rows.length} watched files.`);
