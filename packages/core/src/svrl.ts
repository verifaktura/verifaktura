import type { Issue, Lang, RuleMessage, Severity } from "./types.js";
import { messagesFor, pickMessage } from "./messages.js";

const SVRL_NS = "http://purl.oclc.org/dsdl/svrl";

/**
 * SVRL @flag / @role -> naša ozbiljnost.
 *
 * `flag` je u Schematronu OPCION. Ranije se izostavljen ili nepoznat flag
 * mapirao na `info`, pa bi profil čiji schematron ne postavlja flag imao sve
 * svoje greške spuštene na informativne, a dokument bi ispao validan. Za
 * neuspjelu tvrdnju to je pogrešna pretpostavka: ako izdavač pravila nije rekao
 * drugačije, neuspjeh je greška.
 */
function mapSeverity(flag: string | null, role: string | null, kind: SvrlKind): Severity {
  const value = (flag ?? role ?? "").toLowerCase();
  switch (value) {
    case "fatal":
    case "error":
      return "fatal";
    case "warning":
    case "warn":
      return "warning";
    case "info":
    case "information":
    case "notice":
      return "info";
    default:
      // successful-report je po definiciji informativan; failed-assert nije.
      return kind === "report" ? "info" : "fatal";
  }
}

type SvrlKind = "assert" | "report";

/** Iz teksta pravila izvlači BT-/BG- reference: "[BR-02]-An Invoice shall have ... (BT-1)." */
export function extractBusinessTerms(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b(BT|BG)-\d+(?:-\d+)?\b/g)) found.add(m[0]);
  return [...found];
}

/** Skida "[BR-02]-" prefiks koji CEN stavlja u tekst poruke. */
export function stripRulePrefix(text: string): string {
  return text.replace(/^\s*\[[^\]]+\]\s*-\s*/, "").trim();
}

export interface ParsedSvrl {
  issues: Issue[];
  rulesFired: number;
}

/**
 * Parsira SVRL izlaz Schematron validacije u našu Issue strukturu.
 * `doc` je DOM dokument (u Nodeu: @xmldom/xmldom ili SaxonJS rezultat).
 */
export function parseSvrl(
  doc: Document,
  profile: string,
  lang: Lang,
): ParsedSvrl {
  const issues: Issue[] = [];
  const failed = doc.getElementsByTagNameNS(SVRL_NS, "failed-assert");
  const reports = doc.getElementsByTagNameNS(SVRL_NS, "successful-report");
  const fired = doc.getElementsByTagNameNS(SVRL_NS, "fired-rule");

  const collect = (nodes: HTMLCollectionOf<Element> | any, kind: SvrlKind) => {
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as Element;
      const textEl = el.getElementsByTagNameNS(SVRL_NS, "text")[0];
      const rawText = (textEl?.textContent ?? "").trim();
      const ruleId = el.getAttribute("id") || inferRuleId(rawText) || "UNKNOWN";
      const cleanText = stripRulePrefix(rawText);
      const messages: RuleMessage = messagesFor(ruleId, cleanText);
      issues.push({
        ruleId,
        severity: mapSeverity(el.getAttribute("flag"), el.getAttribute("role"), kind),
        profile,
        businessTerms: extractBusinessTerms(rawText),
        location: { xpath: el.getAttribute("location") ?? "" },
        message: pickMessage(messages, lang as Lang),
        messages,
      });
    }
  };

  collect(failed, "assert");
  collect(reports, "report");

  return { issues, rulesFired: fired.length };
}

/** Ako SVRL nema @id, pokušaj iz "[BR-02]-..." teksta. */
function inferRuleId(text: string): string | null {
  const m = text.match(/^\s*\[([^\]]+)\]/);
  return m ? m[1] : null;
}
