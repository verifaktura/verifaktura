#!/usr/bin/env node
/**
 * Skida CEN/TC 434 validacione artefakte i kompajlira Schematron XSLT u SEF
 * (Saxon Executable Format) koji Saxon-JS izvršava u Nodeu.
 *
 * Pokretanje:  npm run prepare:sef
 * Rezultat:    packages/core/sef/en16931-{ubl,cii}.sef.json
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "vendor", "cen");
const OUT = join(ROOT, "packages", "core", "sef");
const REPO = "https://github.com/ConnectingEurope/eInvoicing-EN16931.git";
const TAG = process.env.CEN_TAG ?? "validation-1.3.16";

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: "inherit", ...opts });

/** Rekurzivno traži prvi fajl koji odgovara regexu. */
function findFile(dir, re) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      const hit = findFile(full, re);
      if (hit) return hit;
    } else if (re.test(name)) {
      return full;
    }
  }
  return null;
}

if (!existsSync(VENDOR)) {
  mkdirSync(dirname(VENDOR), { recursive: true });
  console.log(`Kloniram CEN artefakte (${TAG})...`);
  run("git", ["clone", "--depth", "1", "--branch", TAG, REPO, VENDOR]);
} else {
  console.log("CEN artefakti već postoje, preskačem clone.");
}

mkdirSync(OUT, { recursive: true });

const targets = [
  { name: "en16931-ubl", xsl: join(VENDOR, "ubl", "xslt", "EN16931-UBL-validation.xslt") },
  { name: "en16931-cii", xsl: join(VENDOR, "cii", "xslt", "EN16931-CII-validation.xslt") },
];

for (const t of targets) {
  const dest = join(OUT, `${t.name}.sef.json`);
  console.log(`Kompajliram ${t.name}...`);
  run("npx", ["xslt3", `-xsl:${t.xsl}`, `-export:${dest}`, "-nogo"]);
}

// --- hrvatski CIUS (Fiskalizacija 2.0) -----------------------------------
// Porezna uprava distribuira schematron kao ZIP; sadržaj se smije prenositi uz
// navođenje izvora, ali verziju kontrolira PU pa ga preuzimamo pri buildu.
const HR_ZIP = process.env.HR_VALIDATOR_URL
  ?? "https://porezna.gov.hr/fiskalizacija/api/dokumenti/197";
const HR_OUT = join(ROOT, "packages", "cius-hr", "sef");
const HR_TMP = join(ROOT, "vendor", "hr");

if (process.env.SKIP_HR === "1") {
  console.log("SKIP_HR=1 - preskačem hrvatski profil.");
} else {
  try {
    mkdirSync(HR_TMP, { recursive: true });
    mkdirSync(HR_OUT, { recursive: true });
    const zipPath = join(HR_TMP, "validator.zip");
    console.log("Preuzimam hrvatski validator s porezna.gov.hr...");
    const res = await fetch(HR_ZIP);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    run("unzip", ["-o", "-q", zipPath, "-d", HR_TMP]);

    // Naziv fajla propisuje PU: HR-CIUS-EXT-EN16931-UBL.sch
    const sch = findFile(HR_TMP, /HR-CIUS-EXT-EN16931-UBL\.(sch|xslt?)$/i);
    if (!sch) throw new Error("HR-CIUS-EXT-EN16931-UBL.sch nije pronađen u ZIP-u");

    const dest = join(HR_OUT, "hr-cius-ext-ubl.sef.json");
    console.log("Kompajliram hrvatski profil...");
    run("npx", ["xslt3", `-xsl:${sch}`, `-export:${dest}`, "-nogo"]);
  } catch (e) {
    console.warn(`UPOZORENJE: hrvatski profil nije pripremljen (${e.message}).`);
    console.warn("Jezgro i EN 16931 validacija rade normalno; postavi HR_VALIDATOR_URL ili SKIP_HR=1.");
  }
}

console.log("Gotovo. SEF fajlovi u:", OUT);
