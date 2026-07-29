import type { Lang, RuleMessage } from "./types.js";
import CATALOG from "./catalog/rules.json" with { type: "json" };

interface CatalogEntry {
  en: string;
  flag?: string;
  hr?: string;
  bs?: string;
  sr?: string;
}

const RULES = CATALOG as unknown as Record<string, CatalogEntry>;

/**
 * Lokalizovane poruke pravila.
 *
 * Katalog se generiše iz CEN artefakata skriptom `scripts/gen-messages.py`:
 * jezgro (BR-*, BR-CO-*, BR-CL-*) je ručno prevedeno, PDV porodice i BR-DEC-*
 * se popunjavaju šablonima, a sintaksna pravila (UBL-CR, CII-SR) ostaju na
 * engleskom jer ih krajnji korisnik gotovo nikad ne vidi.
 *
 * Referentni validatori vraćaju samo engleski - ovo je jedna od stvarnih
 * diferencijacija proizvoda.
 */
export function messagesFor(ruleId: string, fallbackEn: string): RuleMessage {
  const hit = RULES[ruleId];
  if (!hit) return { en: fallbackEn };
  const out: RuleMessage = { en: hit.en || fallbackEn };
  if (hit.hr) out.hr = hit.hr;
  if (hit.bs) out.bs = hit.bs;
  if (hit.sr) out.sr = hit.sr;
  return out;
}

/** Razrješava jezik uz fallback na engleski. */
export function pickMessage(messages: RuleMessage, lang: Lang): string {
  return messages[lang] ?? messages.en;
}

/** Statistika pokrivenosti - koristi se u testu i u README badge-u. */
export function catalogStats(): {
  total: number;
  localized: number;
  businessRules: number;
  businessRulesLocalized: number;
} {
  const ids = Object.keys(RULES);
  const br = ids.filter((id) => id.startsWith("BR"));
  return {
    total: ids.length,
    localized: ids.filter((id) => RULES[id].bs !== undefined).length,
    businessRules: br.length,
    businessRulesLocalized: br.filter((id) => RULES[id].bs !== undefined).length,
  };
}
