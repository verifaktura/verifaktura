#!/usr/bin/env node
/**
 * Skida CEN/TC 434 validacione artefakte i kompajlira Schematron XSLT u SEF
 * (Saxon Executable Format) koji Saxon-JS izvršava u Nodeu.
 *
 * Pokretanje:  npm run prepare:sef
 * Rezultat:    packages/core/sef/en16931-{ubl,cii}.sef.json
 */
import { mkdirSync, existsSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileSchematron, compileToSef, findFile, prepareSkeleton, run } from "./schematron.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "vendor", "cen");
const OUT = join(ROOT, "packages", "core", "sef");
const REPO = "https://github.com/ConnectingEurope/eInvoicing-EN16931.git";
const TAG = process.env.CEN_TAG ?? "validation-1.3.16";

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
// Porezna uprava isporučuje SIROVI Schematron (.sch), za razliku od CEN-a koji
// isporučuje prekompajlirani XSLT. Zato ide kroz ISO Schematron lanac.
// Sadržaj se smije prenositi uz navođenje izvora, ali verziju kontroliše PU pa
// se preuzima pri buildu.
const HR_ZIP = process.env.HR_VALIDATOR_URL
  ?? "https://porezna.gov.hr/fiskalizacija/api/dokumenti/197";
const HR_OUT = join(ROOT, "packages", "cius-hr", "sef", "hr-cius-ext-ubl.sef.json");
const HR_TMP = join(ROOT, "vendor", "hr");

if (process.env.SKIP_HR === "1") {
  console.log("SKIP_HR=1 - preskačem hrvatski profil.");
} else {
  try {
    mkdirSync(HR_TMP, { recursive: true });
    const zipPath = join(HR_TMP, "validator.zip");
    if (!existsSync(zipPath)) {
      console.log("Preuzimam hrvatski validator s porezna.gov.hr...");
      const res = await fetch(HR_ZIP);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    }
    run("unzip", ["-o", "-q", zipPath, "-d", HR_TMP]);

    const sch = findFile(HR_TMP, /^HR-CIUS-EXT-EN16931-UBL\.sch$/i);
    if (!sch) throw new Error("HR-CIUS-EXT-EN16931-UBL.sch nije pronađen u ZIP-u");

    console.log("Kompajliram hrvatski profil (ISO Schematron lanac)...");
    const stages = prepareSkeleton(join(ROOT, "vendor"));
    compileSchematron(sch, HR_OUT, join(ROOT, "vendor", "hr-build"), stages);
    console.log("Hrvatski profil spreman.");
  } catch (e) {
    // Tiho preskakanje je ranije omogućavalo objavu paketa bez schematrona.
    // Ako profil svjesno ne treba, to se traži s SKIP_HR=1.
    console.error(`GREŠKA: hrvatski profil nije pripremljen — ${e.message}`);
    console.error("Postavi HR_VALIDATOR_URL ako se izvor promijenio, ili SKIP_HR=1 ako profil svjesno preskačeš.");
    process.exitCode = 1;
    throw e;
  }
}

// Verzije se zapisuju uz artefakte, ne zakucavaju u kod. Izvještaj tvrdi koja
// su pravila izvršena; ako se to razilazi sa stvarnošću, `profiles[].version`
// prestaje biti audit trag i postaje pogrešna tvrdnja.
writeFileSync(
  join(OUT, "artefacts.json"),
  JSON.stringify(
    {
      en16931: { version: TAG.replace(/^validation-/, ""), source: "CEN/TC 434" },
      preparedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

console.log("Gotovo. SEF fajlovi u:", OUT);
