#!/usr/bin/env node
import { validateFile } from "verifaktura";
import type { Lang, ValidationReport } from "verifaktura";

const USAGE = `verifaktura - validacija e-faktura (EN 16931)

  verifaktura <fajl.xml> [opcije]

Opcije:
  --lang <en|hr|bs|sr>   Jezik poruka (default: en)
  --format <text|json>   Format izlaza (default: text)
  --quiet                Samo izlazni kod, bez ispisa
  -h, --help             Ova pomoc

Nacionalni CIUS profili se ucitavaju automatski ako su instalirani, npr.:

  npm i verifaktura @verifaktura/cli @verifaktura/cius-hr

Izlazni kod: 0 = validno, 1 = ima fatalnih gresaka, 2 = greska u radu.
`;

/**
 * Nacionalni profili su zasebni paketi i moraju se importovati da bi se
 * registrovali. Programski to radi korisnik; u CLI-u nema ko, pa ih ucitavamo
 * sami - inace bi hrvatski eRacun prosao samo osnovnu EN 16931 validaciju i jos
 * vratio upozorenja koja HR profil nadjacava.
 */
const KNOWN_PROFILES = ["@verifaktura/cius-hr"];

async function loadInstalledProfiles(): Promise<string[]> {
  const loaded: string[] = [];
  for (const pkg of KNOWN_PROFILES) {
    try {
      await import(pkg);
      loaded.push(pkg);
    } catch {
      // paket nije instaliran - ocekivano, nije greska
    }
  }
  return loaded;
}

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : fallback;
}

function renderText(r: ValidationReport): string {
  const lines: string[] = [];
  const d = r.document;
  lines.push(`${d.type === "creditNote" ? "Odobrenje" : "Faktura"} ${d.id ?? "(bez broja)"} - ${d.syntax.toUpperCase()}`);
  if (d.supplier?.name) lines.push(`  Izdavatelj: ${d.supplier.name}`);
  if (d.payableAmount) lines.push(`  Za plaćanje: ${d.payableAmount} ${d.currency ?? ""}`);
  lines.push("");
  if (r.issues.length === 0) {
    lines.push("Nema nalaza.");
  } else {
    for (const i of r.issues) {
      const tag = i.severity === "fatal" ? "GREŠKA " : i.severity === "warning" ? "UPOZOR." : "INFO   ";
      lines.push(`${tag} ${i.ruleId.padEnd(12)} ${i.message}`);
      if (i.businessTerms.length) lines.push(`${" ".repeat(9)}${" ".repeat(12)} termovi: ${i.businessTerms.join(", ")}`);
    }
  }
  lines.push("");
  lines.push(
    `${r.valid ? "VALIDNO" : "NEVALIDNO"} - ${r.summary.fatal} grešaka, ${r.summary.warning} upozorenja ` +
      `(profili: ${r.profiles.map((p) => p.id).join(", ")}; ` +
      `${r.summary.rulesFired} pravila, ${r.summary.durationMs} ms)`,
  );
  return lines.join("\n");
}

async function main() {
  const file = process.argv[2];
  if (!file || file === "-h" || file === "--help") {
    console.log(USAGE);
    process.exit(file ? 0 : 2);
  }
  await loadInstalledProfiles();
  const report = await validateFile(file, { lang: (arg("--lang", "en") as Lang) });
  if (!process.argv.includes("--quiet")) {
    console.log(arg("--format", "text") === "json" ? JSON.stringify(report, null, 2) : renderText(report));
  }
  process.exit(report.valid ? 0 : 1);
}

main().catch((e) => {
  console.error("Greška:", e instanceof Error ? e.message : e);
  process.exit(2);
});
