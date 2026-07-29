#!/usr/bin/env node
/**
 * End-to-end provjera: validira kontrolne fakture stvarnim SEF artefaktima.
 * Traži da je prethodno pokrenut `npm run prepare:sef` i `npm run build`.
 *
 * Ovo je zaštita koju unit testovi ne daju - oni rade nad snimljenim SVRL
 * izlazom, a ovdje se stvarno izvršava Saxon nad Schematronom.
 */
import { validateFile } from "verifaktura";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "core", "test", "fixtures");

/** @type {{file: string, valid: boolean, mustInclude?: string[]}[]} */
const CASES = [
  { file: "invoice-valid.xml", valid: true },
  { file: "invoice-missing-id-date.xml", valid: false, mustInclude: ["BR-02", "BR-03"] },
  { file: "invoice-ba-bam.xml", valid: false, mustInclude: ["BR-CO-09"] },
];

let failed = 0;

for (const c of CASES) {
  const r = await validateFile(join(FIX, c.file), { lang: "bs" });
  const ids = r.issues.map((i) => i.ruleId);
  const problems = [];

  if (r.valid !== c.valid) problems.push(`očekivano valid=${c.valid}, dobiveno ${r.valid}`);
  for (const id of c.mustInclude ?? []) {
    if (!ids.includes(id)) problems.push(`nedostaje pravilo ${id}`);
  }
  if (r.summary.rulesFired < 20) problems.push(`sumnjivo malo izvršenih pravila (${r.summary.rulesFired})`);

  if (problems.length) {
    failed++;
    console.error(`FAIL ${c.file}`);
    for (const p of problems) console.error(`     ${p}`);
    console.error(`     nalazi: ${ids.join(", ") || "(nema)"}`);
  } else {
    console.log(`ok   ${c.file} (${r.summary.fatal} grešaka, ${r.summary.rulesFired} pravila, ${r.summary.durationMs} ms)`);
  }
}

if (failed) {
  console.error(`\n${failed} od ${CASES.length} slučajeva nije prošlo.`);
  process.exit(1);
}
console.log(`\nSvih ${CASES.length} slučajeva prošlo.`);
