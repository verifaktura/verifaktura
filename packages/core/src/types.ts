/** Ozbiljnost nalaza. `fatal` = dokument je nevalidan. */
export type Severity = "fatal" | "warning" | "info";

/** Sintaksa dokumenta. */
export type Syntax = "ubl" | "cii";

/** Jezik poruka. Fallback lanac: traženi -> en. */
export type Lang = "en" | "hr" | "bs" | "sr";

export interface RuleMessage {
  en: string;
  hr?: string;
  bs?: string;
  sr?: string;
}

export interface IssueLocation {
  /** XPath kako ga vraća Schematron (SVRL @location). */
  xpath: string;
  /** Linija u izvornom XML-u, ako je mapiranje uspjelo. */
  line?: number;
  /** Kolona u izvornom XML-u, ako je mapiranje uspjelo. */
  column?: number;
}

export interface Issue {
  /** ID pravila, npr. "BR-02", "PEPPOL-EN16931-R001", "HR-BR-01". */
  ruleId: string;
  severity: Severity;
  /** Profil koji je pravilo prijavio: "en16931" | "hr" | "sef" | "fbih" | ... */
  profile: string;
  /** EN 16931 business termovi na koje se pravilo odnosi, npr. ["BT-1"]. */
  businessTerms: string[];
  location: IssueLocation;
  /** Poruka na traženom jeziku (već razriješen fallback). */
  message: string;
  /** Sve dostupne lokalizacije - korisno za API klijente koji sami biraju. */
  messages: RuleMessage;
  /** Praktična uputa kako popraviti. Opcionalno, popunjeno za česta pravila. */
  hint?: string;
}

export interface DocumentSummary {
  syntax: Syntax;
  type: "invoice" | "creditNote" | "unknown";
  customizationId?: string;
  profileId?: string;
  id?: string;
  issueDate?: string;
  currency?: string;
  supplier?: { name?: string; vatId?: string };
  customer?: { name?: string; vatId?: string };
  payableAmount?: string;
}

export interface ProfileInfo {
  /** Identifikator profila, npr. "en16931". */
  id: string;
  /** Verzija validacionih artefakata, npr. "1.3.16". */
  version: string;
  /** Izvor artefakata, npr. "CEN/TC 434". */
  source: string;
}

export interface ValidationReport {
  /** Verzija formata izvještaja (semver). Mijenja se samo uz breaking change. */
  reportVersion: "1.0";
  /** Verzija verifaktura biblioteke koja je proizvela izvještaj. */
  engine: string;
  validatedAt: string;
  /** true ako nema nijednog `fatal` nalaza. */
  valid: boolean;
  document: DocumentSummary;
  profiles: ProfileInfo[];
  summary: {
    fatal: number;
    warning: number;
    info: number;
    rulesFired: number;
    durationMs: number;
  };
  issues: Issue[];
}

export interface ValidateOptions {
  /** Jezik poruka. Default "en". */
  lang?: Lang;
  /** Dodatni CIUS profili uz osnovni EN 16931, npr. ["hr"]. */
  profiles?: string[];
  /** Preskoči XSD provjeru šeme (brže, ali propušta strukturne greške). */
  skipSchema?: boolean;
  /** Prekini nakon N nalaza (zaštita za API). */
  maxIssues?: number;
}
