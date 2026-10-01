import type { Lang, ValidationReport } from "verifaktura";

/** Tri oblika imenice uz broj: 1 greška, 2 greške, 5 grešaka. */
type Forms = readonly [one: string, few: string, many: string];

/**
 * Oblik imenice uz broj.
 *
 * hr/bs/sr: jednina za 1, 21, 31… (osim 11); "paukal" za 2–4, 22–24…
 * (osim 12–14); genitiv množine za sve ostalo. Engleski ima samo jedninu
 * za 1 i množinu za sve ostalo.
 */
export function plural(lang: Lang, n: number, forms: Forms): string {
  const abs = Math.abs(n);
  if (lang === "en") return abs === 1 ? forms[0] : forms[2];
  const d = abs % 10;
  const dd = abs % 100;
  if (d === 1 && dd !== 11) return forms[0];
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return forms[1];
  return forms[2];
}

interface Labels {
  invoice: string;
  creditNote: string;
  noNumber: string;
  supplier: string;
  payable: string;
  noFindings: string;
  /** Oznake težine, sve iste širine radi poravnanja kolona. */
  fatal: string;
  warning: string;
  info: string;
  terms: string;
  valid: string;
  invalid: string;
  errors: Forms;
  warnings: Forms;
  rules: Forms;
  profiles: string;
}

const LABELS: Record<Lang, Labels> = {
  en: {
    invoice: "Invoice",
    creditNote: "Credit note",
    noNumber: "(no number)",
    supplier: "Supplier",
    payable: "Amount due",
    noFindings: "No findings.",
    fatal: "ERROR  ",
    warning: "WARNING",
    info: "INFO   ",
    terms: "terms",
    valid: "VALID",
    invalid: "INVALID",
    errors: ["error", "errors", "errors"],
    warnings: ["warning", "warnings", "warnings"],
    rules: ["rule", "rules", "rules"],
    profiles: "profiles",
  },
  hr: {
    invoice: "Račun",
    creditNote: "Odobrenje",
    noNumber: "(bez broja)",
    supplier: "Izdavatelj",
    payable: "Za plaćanje",
    noFindings: "Nema nalaza.",
    fatal: "GREŠKA ",
    warning: "UPOZOR.",
    info: "INFO   ",
    terms: "pojmovi",
    valid: "VALIDNO",
    invalid: "NEVALIDNO",
    errors: ["greška", "greške", "grešaka"],
    warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    profiles: "profili",
  },
  bs: {
    invoice: "Faktura",
    creditNote: "Odobrenje",
    noNumber: "(bez broja)",
    supplier: "Izdavalac",
    payable: "Za plaćanje",
    noFindings: "Nema nalaza.",
    fatal: "GREŠKA ",
    warning: "UPOZOR.",
    info: "INFO   ",
    terms: "termini",
    valid: "VALIDNO",
    invalid: "NEVALIDNO",
    errors: ["greška", "greške", "grešaka"],
    warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    profiles: "profili",
  },
  sr: {
    invoice: "Faktura",
    creditNote: "Odobrenje",
    noNumber: "(bez broja)",
    supplier: "Izdavalac",
    payable: "Za plaćanje",
    noFindings: "Nema nalaza.",
    fatal: "GREŠKA ",
    warning: "UPOZOR.",
    info: "INFO   ",
    terms: "termini",
    valid: "VALIDNO",
    invalid: "NEVALIDNO",
    errors: ["greška", "greške", "grešaka"],
    warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    profiles: "profili",
  },
};

function count(lang: Lang, n: number, forms: Forms): string {
  return `${n} ${plural(lang, n, forms)}`;
}

/**
 * Tekstualni izvještaj za terminal, na traženom jeziku.
 *
 * Ranije je okvir izvještaja uvijek bio na hrvatskom (i uz `--lang en`), a
 * brojevi su se slagali kao "1 grešaka".
 */
export function renderText(r: ValidationReport, lang: Lang): string {
  const L = LABELS[lang] ?? LABELS.en;
  const d = r.document;
  const lines: string[] = [];
  lines.push(
    `${d.type === "creditNote" ? L.creditNote : L.invoice} ${d.id ?? L.noNumber} - ${d.syntax.toUpperCase()}`,
  );
  if (d.supplier?.name) lines.push(`  ${L.supplier}: ${d.supplier.name}`);
  if (d.payableAmount) lines.push(`  ${L.payable}: ${d.payableAmount} ${d.currency ?? ""}`.trimEnd());
  lines.push("");
  if (r.issues.length === 0) {
    lines.push(L.noFindings);
  } else {
    for (const i of r.issues) {
      const tag = i.severity === "fatal" ? L.fatal : i.severity === "warning" ? L.warning : L.info;
      lines.push(`${tag} ${i.ruleId.padEnd(12)} ${i.message}`);
      if (i.businessTerms.length) {
        lines.push(`${" ".repeat(tag.length + 1)}${" ".repeat(12)} ${L.terms}: ${i.businessTerms.join(", ")}`);
      }
    }
  }
  lines.push("");
  lines.push(
    `${r.valid ? L.valid : L.invalid} - ${count(lang, r.summary.fatal, L.errors)}, ` +
      `${count(lang, r.summary.warning, L.warnings)} ` +
      `(${L.profiles}: ${r.profiles.map((p) => p.id).join(", ")}; ` +
      `${count(lang, r.summary.rulesFired, L.rules)}, ${r.summary.durationMs} ms)`,
  );
  return lines.join("\n");
}
