#!/usr/bin/env node
/**
 * Provjerava da svaki paket koji isporučuje validacione artefakte stvarno ima
 * te fajlove, i da su upotrebljivi.
 *
 * Zašto postoji: `sef/*.json` je gitignorisan i nastaje tek pri buildu.
 * `build-sef.mjs` je nekad tiho preskakao nacionalni profil kad izvor nije
 * dostupan, pa je bilo moguće objaviti @verifaktura/cius-hr bez schematrona -
 * paket bi se instalirao, profil registrovao, a validacija ne bi radila ništa.
 * Tiha neispravnost je za validator gori ishod od pada.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {{pkg: string, file: string, minBytes: number}[]} */
const REQUIRED = [
  { pkg: "packages/core", file: "sef/en16931-ubl.sef.json", minBytes: 1_000_000 },
  { pkg: "packages/core", file: "sef/en16931-cii.sef.json", minBytes: 1_000_000 },
  { pkg: "packages/cius-hr", file: "sef/hr-cius-ext-ubl.sef.json", minBytes: 100_000 },
];

let failed = 0;

for (const { pkg, file, minBytes } of REQUIRED) {
  const full = join(ROOT, pkg, file);
  const label = `${pkg}/${file}`;

  if (!existsSync(full)) {
    console.error(`NEDOSTAJE  ${label}`);
    failed++;
    continue;
  }

  const size = statSync(full).size;
  if (size < minBytes) {
    console.error(`PREMALEN   ${label} (${size} B, očekivano >= ${minBytes} B)`);
    failed++;
    continue;
  }

  // SEF je JSON; oštećen fajl bi pukao tek pri prvoj validaciji kod korisnika
  try {
    const sef = JSON.parse(readFileSync(full, "utf-8"));
    if (!sef || typeof sef !== "object") throw new Error("nije objekat");
  } catch (e) {
    console.error(`NEISPRAVAN ${label}: ${e.message}`);
    failed++;
    continue;
  }

  // paket mora i deklarisati da ga isporučuje
  const pkgJson = JSON.parse(readFileSync(join(ROOT, pkg, "package.json"), "utf-8"));
  if (!(pkgJson.files ?? []).includes("sef")) {
    console.error(`NIJE U files  ${pkg}/package.json ne uključuje "sef"`);
    failed++;
    continue;
  }

  console.log(`ok  ${label} (${(size / 1_048_576).toFixed(1)} MB)`);
}

if (failed) {
  console.error(`\n${failed} problema s artefaktima — objava se zaustavlja.`);
  process.exit(1);
}
console.log("\nSvi artefakti su na mjestu.");
