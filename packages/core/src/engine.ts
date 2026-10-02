import { detectSyntax, summarizeUbl } from "./detect.js";
import { parseSvrl } from "./svrl.js";
import { overrideHint } from "./messages.js";
import { resolveProfiles, type ProfileDefinition } from "./profiles.js";
import type {
  Issue,
  ProfileInfo,
  Syntax,
  ValidateOptions,
  ValidationReport,
} from "./types.js";

/**
 * Sve što validacija treba od okoline. Node (`validate.ts`) i preglednik daju
 * različite implementacije; orkestracija ostaje jedna, pa se izvještaji ne
 * mogu razići.
 */
export interface EngineRuntime {
  /** Oznaka engine-a u izvještaju, npr. "0.2.0". */
  engineVersion: string;
  /** Verzija i izvor CEN artefakata koje je build stvarno pripremio. */
  artefacts: { version: string; source: string };
  /** Lokator osnovnog EN 16931 SEF-a po sintaksi (putanja ili URL). */
  baseSef: Record<Syntax, string>;
  /** Učitava SEF za lokator: `ProfileDefinition.sefPath` ili `baseSef`. */
  loadSef(locator: string): Promise<unknown>;
  /** Izvršava SEF nad dokumentom i vraća SVRL kao string. */
  transform(sef: unknown, xml: string): Promise<string>;
  /** Parsira XML; baca grešku s opisom ako dokument nije ispravan. */
  parseXml(text: string): Document;
}

/**
 * Uklanja UTF-8 BOM.
 *
 * Datoteke spremljene iz Windows alata ga redovno nose, a XML parser na njemu
 * puca prije nego što dođe do sadržaja - dokument bi bio odbijen s nejasnom
 * greškom umjesto da se validira.
 */
function stripBom(xml: string): string {
  return xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
}

/** Validira dokument uz dati runtime. U Nodeu isto radi `validate()`. */
export async function runValidation(
  xml: string,
  opts: ValidateOptions,
  rt: EngineRuntime,
): Promise<ValidationReport> {
  const started = Date.now();
  const lang = opts.lang ?? "en";

  /**
   * Parser na neispravnom XML-u baca grešku bez konteksta. Bez ovoga korisnik
   * dobije poruku iz utrobe parsera umjesto podatka šta je krivo - a najčešći
   * uzrok je BOM ili pogrešno kodiranje, ne sadržaj dokumenta.
   */
  const parse = (s: string, what: string): Document => {
    try {
      return rt.parseXml(s);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Nije moguće parsirati ${what}: ${detail}`);
    }
  };
  const runSef = async (locator: string, source: string): Promise<string> =>
    rt.transform(await rt.loadSef(locator), source);

  const source = stripBom(xml);
  const doc = parse(source, "XML dokument");
  const { syntax, type } = detectSyntax(doc);
  const summary = syntax === "ubl" ? summarizeUbl(doc) : {};

  const profilesUsed: ProfileInfo[] = [
    { id: "en16931", version: rt.artefacts.version, source: rt.artefacts.source },
  ];
  const issues: Issue[] = [];
  let rulesFired = 0;

  const base = parseSvrl(
    parse(await runSef(rt.baseSef[syntax], source), "SVRL izvještaj"),
    "en16931",
    lang,
  );
  issues.push(...base.issues);
  rulesFired += base.rulesFired;

  // Nacionalni profili se izvršavaju NAKON osnovne validacije: njihova pravila
  // pretpostavljaju da je dokument već prošao EN 16931 strukturu.
  const extra: ProfileDefinition[] = resolveProfiles(
    summary.customizationId,
    syntax,
    opts.profiles,
  );
  for (const p of extra) {
    const res = parseSvrl(
      parse(await runSef(p.sefPath, source), `SVRL izvještaj profila "${p.id}"`),
      p.id,
      lang,
    );
    issues.push(...res.issues);
    rulesFired += res.rulesFired;
    profilesUsed.push({ id: p.id, version: p.version, source: p.source });
  }

  // Pravila koja aktivni nacionalni profili namjerno nadjačavaju spuštamo na
  // `info` umjesto da ih brišemo - korisnik i dalje vidi da je pravilo palo,
  // ali ga to ne alarmira niti obara dokument.
  const overridden = new Map<string, string>();
  for (const p of extra) {
    for (const ruleId of p.overrides ?? []) overridden.set(ruleId, p.id);
  }
  if (overridden.size > 0) {
    for (const issue of issues) {
      const by = overridden.get(issue.ruleId);
      if (by && issue.profile === "en16931") {
        issue.severity = "info";
        issue.hint = overrideHint(by, lang);
      }
    }
  }

  // Sažetak i verdikt se računaju iz SVIH nalaza: fatalni nalaz iza `maxIssues`
  // granice i dalje obara dokument.
  const count = (s: string): number => issues.filter((i) => i.severity === s).length;

  // 0 je valjan limit: samo sažetak, bez nalaza.
  const limited =
    opts.maxIssues !== undefined && opts.maxIssues >= 0
      ? issues.slice(0, opts.maxIssues)
      : issues;
  const truncated = limited.length < issues.length;

  return {
    reportVersion: "1.0",
    engine: `verifaktura/${rt.engineVersion}`,
    validatedAt: new Date().toISOString(),
    valid: count("fatal") === 0,
    document: { syntax, type, ...summary },
    profiles: profilesUsed,
    summary: {
      fatal: count("fatal"),
      warning: count("warning"),
      info: count("info"),
      rulesFired,
      durationMs: Date.now() - started,
    },
    ...(truncated ? { truncated: true as const } : {}),
    issues: limited,
  };
}
