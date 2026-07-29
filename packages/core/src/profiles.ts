import type { Syntax } from "./types.js";

/**
 * Definicija validacionog profila (CIUS/proširenje) koji se izvršava NAKON
 * osnovne EN 16931 validacije. Nacionalni profili se registruju kao zasebni
 * npm paketi (@verifaktura/cius-hr, ...) da jezgro ne nosi teret svih zemalja.
 */
export interface ProfileDefinition {
  /** Kratki identifikator, npr. "hr". Pojavljuje se u Issue.profile. */
  id: string;
  /** Naziv za ispis, npr. "Hrvatska - Fiskalizacija 2.0". */
  label: string;
  /** Verzija artefakata, npr. "2026-03-15". */
  version: string;
  /** Izvor artefakata (za atribuciju i audit trag). */
  source: string;
  /** Sintakse koje profil pokriva. */
  syntax: Syntax[];
  /** Vraća true ako se profil primjenjuje na dati cbc:CustomizationID. */
  matches(customizationId: string | undefined): boolean;
  /** Apsolutna putanja do prekompajliranog SEF fajla. */
  sefPath: string;
  /**
   * ID-evi osnovnih EN 16931 pravila koja ovaj profil namjerno krši.
   *
   * Nacionalni CIUS-i traže elemente koje CEN-ova sintaksna pravila označavaju
   * s "should not include" - npr. hrvatski eRačun zahtijeva cbc:IssueTime
   * (HR-BR-2) iako UBL-CR-006 kaže da ga ne treba biti. Bez ovoga bi svaki
   * ispravan hrvatski račun vraćao upozorenja i korisnik bi ih naučio
   * ignorisati, što je gore nego da ih nema.
   *
   * Navedena pravila se ne skrivaju - spuštaju se na `info` i dobiju napomenu
   * koji profil ih nadjačava.
   */
  overrides?: string[];
}

const REGISTRY = new Map<string, ProfileDefinition>();

/** Registruje profil. Pozivaju ga nacionalni paketi pri importu. */
export function registerProfile(profile: ProfileDefinition): void {
  REGISTRY.set(profile.id, profile);
}

/** Svi registrovani profili. */
export function listProfiles(): ProfileDefinition[] {
  return [...REGISTRY.values()];
}

/**
 * Bira profile za izvršavanje.
 * - eksplicitno traženi (`opts.profiles`) uvijek se izvršavaju; nepoznat id je greška
 * - ako nije ništa traženo, automatski se biraju profili koji prepoznaju CustomizationID
 */
export function resolveProfiles(
  customizationId: string | undefined,
  syntax: Syntax,
  requested?: string[],
): ProfileDefinition[] {
  if (requested?.length) {
    return requested.map((id) => {
      const p = REGISTRY.get(id);
      if (!p) {
        const known = [...REGISTRY.keys()].join(", ") || "(nijedan registrovan)";
        throw new Error(`Nepoznat profil "${id}". Registrovani profili: ${known}`);
      }
      // Eksplicitan zahtjev ne smije zaobići provjeru sintakse: UBL profil nad
      // CII dokumentom ne bi prijavio nijedno pravilo, a u izvještaju bi stajao
      // kao da je validirao - tiho lažno uvjerenje da je provjera obavljena.
      if (!p.syntax.includes(syntax)) {
        throw new Error(
          `Profil "${id}" pokriva ${p.syntax.join(", ").toUpperCase()}, ` +
            `a dokument je ${syntax.toUpperCase()}.`,
        );
      }
      return p;
    });
  }
  return [...REGISTRY.values()].filter(
    (p) => p.syntax.includes(syntax) && p.matches(customizationId),
  );
}
