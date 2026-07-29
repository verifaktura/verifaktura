#!/usr/bin/env node
/**
 * Postavlja istu verziju na sve pakete i usklađuje interne zavisnosti.
 *
 *   node scripts/version.mjs patch|minor|major|1.2.3
 *
 * Paketi se objavljuju u lockstepu (svi na istoj verziji). Za četiri paketa
 * koja se uvijek objavljuju zajedno to je jednostavnije i manje sklono grešci
 * nego nezavisno verzionisanje - a korisniku je odmah jasno šta ide s čim.
 *
 * `npm version --workspaces` ne ažurira pouzdano interne raspone zavisnosti,
 * pa ih postavljamo ovdje eksplicitno.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = ["packages/core", "packages/build", "packages/cius-hr", "packages/cli"];
const DEP_FIELDS = ["dependencies", "peerDependencies", "devDependencies"];

const arg = process.argv[2];
if (!arg) {
  console.error("Upotreba: node scripts/version.mjs patch|minor|major|<verzija>");
  process.exit(2);
}

const read = (p) => JSON.parse(readFileSync(join(ROOT, p, "package.json"), "utf-8"));
const write = (p, d) =>
  writeFileSync(join(ROOT, p, "package.json"), JSON.stringify(d, null, 2) + "\n", "utf-8");

function bump(current, kind) {
  if (/^\d+\.\d+\.\d+/.test(kind)) return kind;
  const [major, minor, patch] = current.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Nepoznat tip promjene: ${kind}`);
}

const current = read("packages/core").version;
const next = bump(current, arg);
const names = new Set(PACKAGES.map((p) => read(p).name));

for (const p of PACKAGES) {
  const pkg = read(p);
  pkg.version = next;
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (names.has(dep)) pkg[field][dep] = `^${next}`;
    }
  }
  write(p, pkg);
}

console.log(`${current} -> ${next}`);
// za GitHub Actions
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`, { flag: "a" });
}
