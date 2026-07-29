import type { Issue, Lang, RuleMessage, Severity } from "./types.js";
import { messagesFor, pickMessage } from "./messages.js";

const SVRL_NS = "http://purl.oclc.org/dsdl/svrl";

/** SVRL @flag -> naša ozbiljnost. CEN koristi fatal/warning; ostalo tretiramo kao info. */
function mapSeverity(flag: string | null): Severity {
  switch ((flag ?? "").toLowerCase()) {
    case "fatal":
    case "error":
      return "fatal";
    case "warning":
    case "warn":
      return "warning";
    default:
      return "info";
  }
}

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

  const collect = (nodes: HTMLCollectionOf<Element> | any) => {
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as Element;
      const textEl = el.getElementsByTagNameNS(SVRL_NS, "text")[0];
      const rawText = (textEl?.textContent ?? "").trim();
      const ruleId = el.getAttribute("id") || inferRuleId(rawText) || "UNKNOWN";
      const cleanText = stripRulePrefix(rawText);
      const messages: RuleMessage = messagesFor(ruleId, cleanText);
      issues.push({
        ruleId,
        severity: mapSeverity(el.getAttribute("flag")),
        profile,
        businessTerms: extractBusinessTerms(rawText),
        location: { xpath: el.getAttribute("location") ?? "" },
        message: pickMessage(messages, lang as Lang),
        messages,
      });
    }
  };

  collect(failed);
  collect(reports);

  return { issues, rulesFired: fired.length };
}

/** Ako SVRL nema @id, pokušaj iz "[BR-02]-..." teksta. */
function inferRuleId(text: string): string | null {
  const m = text.match(/^\s*\[([^\]]+)\]/);
  return m ? m[1] : null;
}
