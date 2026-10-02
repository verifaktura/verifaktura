#!/usr/bin/env node
/**
 * Gradi statični web validator u web/dist.
 *
 * Bez bundlera: dist/ jezgra je ESM s relativnim importima, pa se kopira kako
 * jeste. Pretpostavlja `npm run prepare:sef` i `npm run build`.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB, "..");
const DIST = join(WEB, "dist");
const CACHE = join(WEB, ".cache");

// SaxonJS 2 nije na npm-u za preglednik. Zip je fiksiran po sadržaju: druga
// datoteka pod istim imenom ruši build umjesto da tiho uđe u stranicu.
const SAXON_URL = "https://downloads.saxonica.com/SaxonJS/2/SaxonJS-2.7.zip";
const SAXON_SHA256 = "13cbd2e6eb0a80dcf64067e88cb5eab54a52c3a29e01fe0b156346895585845d";

const REQUIRED = [
  "packages/core/dist/portable.js",
  "packages/core/sef/en16931-ubl.sef.json",
  "packages/core/sef/en16931-cii.sef.json",
  "packages/core/sef/artefacts.json",
  "packages/cius-hr/dist/profile.js",
  "packages/cius-hr/sef/hr-cius-ext-ubl.sef.json",
  "packages/core/test/fixtures/invoice-missing-id-date.xml",
];

async function saxonZip() {
  const zip = join(CACHE, "SaxonJS-2.7.zip");
  if (!existsSync(zip)) {
    mkdirSync(CACHE, { recursive: true });
    const res = await fetch(SAXON_URL);
    if (!res.ok) throw new Error(`${SAXON_URL}: HTTP ${res.status}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  }
  const sha = createHash("sha256").update(readFileSync(zip)).digest("hex");
  if (sha !== SAXON_SHA256) {
    rmSync(zip);
    throw new Error(`SaxonJS zip ima sha256 ${sha}, očekivan ${SAXON_SHA256}`);
  }
  return zip;
}

const missing = REQUIRED.filter((p) => !existsSync(join(ROOT, p)));
if (missing.length) {
  console.error("Nedostaje (pokreni `npm run prepare:sef` i `npm run build`):");
  for (const p of missing) console.error(`  ${p}`);
  process.exit(1);
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, "sef"), { recursive: true });

cpSync(join(WEB, "src"), DIST, { recursive: true });
cpSync(join(ROOT, "packages/core/test/fixtures/invoice-missing-id-date.xml"), join(DIST, "sample-invoice.xml"));
cpSync(join(ROOT, "packages/core/dist"), join(DIST, "lib/core"), {
  recursive: true,
  // index.js i validate.js vuku node: module; stranica koristi samo portable.js.
  filter: (src) =>
    !/\.(d\.ts|map)$/.test(src) && !/[\\/](index|validate)\.js$/.test(src),
});
cpSync(join(ROOT, "packages/cius-hr/dist/profile.js"), join(DIST, "lib/cius-hr/profile.js"));
for (const f of ["en16931-ubl.sef.json", "en16931-cii.sef.json", "artefacts.json"]) {
  cpSync(join(ROOT, "packages/core/sef", f), join(DIST, "sef", f));
}
cpSync(join(ROOT, "packages/cius-hr/sef/hr-cius-ext-ubl.sef.json"), join(DIST, "sef/hr-cius-ext-ubl.sef.json"));

const zip = await saxonZip();
const unpacked = join(CACHE, "saxonjs");
rmSync(unpacked, { recursive: true, force: true });
execFileSync("unzip", ["-q", zip, "saxon-js/SaxonJS2.rt.js", "saxon-js/LICENSE.txt", "-d", unpacked]);
cpSync(join(unpacked, "saxon-js/SaxonJS2.rt.js"), join(DIST, "vendor/SaxonJS2.rt.js"));
cpSync(join(unpacked, "saxon-js/LICENSE.txt"), join(DIST, "vendor/SaxonJS-LICENSE.txt"));

const { version } = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf-8"));
console.log(`web/dist spreman (verifaktura ${version})`);
