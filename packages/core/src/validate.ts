import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { detectSyntax, summarizeUbl } from "./detect.js";
import { parseSvrl } from "./svrl.js";
import { resolveProfiles, type ProfileDefinition } from "./profiles.js";
import type {
  Issue,
  ProfileInfo,
  Syntax,
  ValidateOptions,
  ValidationReport,
} from "./types.js";

const require = createRequire(import.meta.url);

/**
 * Verzija se čita iz package.json, ne prepisuje ručno. Izvještaj se koristi kao
 * audit trag, pa netačna oznaka engine-a obara njegovu svrhu - a zakucana
 * konstanta se zaboravi pri svakoj objavi.
 */
const ENGINE_VERSION: string = (
  require("../package.json") as { version: string }
).version;
/** Verzija CEN/TC 434 validacionih artefakata na koju je build pinovan. */
const ARTEFACT_VERSION = "1.3.16";

const BASE_SEF: Record<Syntax, string> = {
  ubl: fileURLToPath(new URL("../sef/en16931-ubl.sef.json", import.meta.url)),
  cii: fileURLToPath(new URL("../sef/en16931-cii.sef.json", import.meta.url)),
};

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

/**
 * Učitani SEF-ovi, po putanji.
 *
 * Saxon-JS ne kešira `stylesheetFileName`, pa je svaki poziv iznova čitao i
 * JSON-parsirao 5–7 MB s diska. Za API koji validira dokument za dokumentom to
 * je bio najveći pojedinačni trošak, a stylesheet se između poziva ne mijenja.
 */
const SEF_CACHE = new Map<string, unknown>();

function loadSef(sefPath: string): unknown {
  let sef = SEF_CACHE.get(sefPath);
  if (sef === undefined) {
    sef = JSON.parse(readFileSync(sefPath, "utf-8"));
    SEF_CACHE.set(sefPath, sef);
  }
  return sef;
}

/** Prazni keš stylesheetova. Korisno u testovima i nakon zamjene artefakata. */
export function clearSefCache(): void {
  SEF_CACHE.clear();
}

/**
 * Pokreće jedan SEF nad dokumentom i vraća SVRL kao string.
 *
 * `destination: "document"` bi uštedio jedno parsiranje, ali Saxon tada vraća
 * vlastitu DOM implementaciju bez `getElementsByTagNameNS`, pa bi parser SVRL-a
 * morao raditi s dva različita DOM-a. Ušteda ne vrijedi te cijene — glavni
 * trošak je ionako bio učitavanje SEF-a, koje sada ide iz keša.
 */
async function runSef(sefPath: string, xml: string): Promise<string> {
  const SaxonJS = require("saxon-js");
  const result = await SaxonJS.transform(
    {
      stylesheetInternal: loadSef(sefPath),
      sourceText: xml,
      destination: "serialized",
    },
    "async",
  );
  return result.principalResult as string;
}

/**
 * Validira e-fakturu prema EN 16931 i, opcionalno, nacionalnim CIUS profilima.
 *
 * Profili se biraju automatski prema cbc:CustomizationID (ako je odgovarajući
 * paket importovan) ili eksplicitno preko `opts.profiles`.
 *
 * @example
 * ```ts
 * import { validate } from "verifaktura";
 * import "@verifaktura/cius-hr";        // registruje hrvatski profil
 *
 * const report = await validate(xml, { lang: "hr" });
 * ```
 */
export async function validate(
  xml: string,
  opts: ValidateOptions = {},
): Promise<ValidationReport> {
  const started = Date.now();
  const lang = opts.lang ?? "en";
  const { DOMParser } = require("@xmldom/xmldom");

  /**
   * xmldom na neispravnom XML-u baca ParseError bez konteksta. Bez ovoga
   * korisnik dobije poruku iz utrobe parsera umjesto podatka šta je krivo -
   * a najčešći uzrok je BOM ili pogrešno kodiranje, ne sadržaj dokumenta.
   */
  const parse = (s: string, what: string): Document => {
    try {
      const doc = new DOMParser({
        onError: (level: string, msg: string) => {
          if (level === "error" || level === "fatalError") throw new Error(msg);
        },
      }).parseFromString(s, "text/xml") as unknown as Document;
      if (!doc?.documentElement) throw new Error("dokument nema korijenski element");
      return doc;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Nije moguće parsirati ${what}: ${detail}`);
    }
  };

  const source = stripBom(xml);
  const doc = parse(source, "XML dokument");
  const { syntax, type } = detectSyntax(doc);
  const summary = syntax === "ubl" ? summarizeUbl(doc) : {};

  const profilesUsed: ProfileInfo[] = [
    { id: "en16931", version: ARTEFACT_VERSION, source: "CEN/TC 434" },
  ];
  const issues: Issue[] = [];
  let rulesFired = 0;

  // 1) osnovna EN 16931 validacija
  const base = parseSvrl(
    parse(await runSef(BASE_SEF[syntax], source), "SVRL izvještaj"),
    "en16931",
    lang,
  );
  issues.push(...base.issues);
  rulesFired += base.rulesFired;

  // 2) nacionalni profili - izvršavaju se NAKON osnovne validacije
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
        issue.hint = `Pravilo nadjačava profil "${by}", koji ovaj element zahtijeva.`;
      }
    }
  }

  // Sažetak i verdikt se računaju iz SVIH nalaza, ne iz skraćenog popisa.
  // Ranije je `maxIssues` odsijecao i brojeve, pa je fatalni nalaz iza granice
  // pretvarao dokument u valid:true - tiho, i to baš kod velikih dokumenata
  // gdje se limit i koristi.
  const count = (s: string): number => issues.filter((i) => i.severity === s).length;

  // 0 je valjan limit (samo sažetak, bez nalaza); ranije se tretirao kao "bez limita".
  const limited =
    opts.maxIssues !== undefined && opts.maxIssues >= 0
      ? issues.slice(0, opts.maxIssues)
      : issues;
  const truncated = limited.length < issues.length;

  return {
    reportVersion: "1.0",
    engine: `verifaktura/${ENGINE_VERSION}`,
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

/** Kao `validate`, ali čita dokument s diska. */
export async function validateFile(
  path: string,
  opts: ValidateOptions = {},
): Promise<ValidationReport> {
  return validate(await readFile(path, "utf-8"), opts);
}
