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

export function getProfile(id: string): ProfileDefinition | undefined {
  return REGISTRY.get(id);
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
      return p;
    });
  }
  return [...REGISTRY.values()].filter(
    (p) => p.syntax.includes(syntax) && p.matches(customizationId),
  );
}
