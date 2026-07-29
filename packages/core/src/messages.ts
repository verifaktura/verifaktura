import type { Lang, RuleMessage } from "./types.js";
import CATALOG from "./catalog/rules.json" with { type: "json" };

interface CatalogEntry {
  en: string;
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

/**
 * Napomena uz pravilo koje nacionalni profil nadjačava.
 *
 * Bila je zakucana na hrvatskom u `validate.ts`, pa je lokalizacijska
 * infrastruktura zaobilazila samu sebe - engleski korisnik je dobivao poruku na
 * hrvatskom usred engleskog izvještaja.
 */
export function overrideHint(profileId: string, lang: Lang): string {
  const templates: Record<Lang, string> = {
    en: `Overridden by profile "${profileId}", which requires this element.`,
    hr: `Pravilo nadjačava profil "${profileId}", koji ovaj element zahtijeva.`,
    bs: `Pravilo nadjačava profil "${profileId}", koji ovaj element zahtijeva.`,
    sr: `Pravilo nadjačava profil "${profileId}", koji ovaj element zahteva.`,
  };
  return templates[lang] ?? templates.en;
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
  // Prisutnost bilo kojeg prijevoda, ne baš "bs" - marker jednog jezika bi tiho
  // podbacio čim se doda jezik koji ga ne prati.
  const localized = (id: string): boolean =>
    RULES[id].hr !== undefined || RULES[id].bs !== undefined || RULES[id].sr !== undefined;

  return {
    total: ids.length,
    localized: ids.filter(localized).length,
    businessRules: br.length,
    businessRulesLocalized: br.filter(localized).length,
  };
}
