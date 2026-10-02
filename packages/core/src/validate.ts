import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runValidation, type EngineRuntime } from "./engine.js";
import type { Syntax, ValidateOptions, ValidationReport } from "./types.js";

const require = createRequire(import.meta.url);

/**
 * Verzija se čita iz package.json, ne prepisuje ručno. Izvještaj se koristi kao
 * audit trag, pa netačna oznaka engine-a obara njegovu svrhu - a zakucana
 * konstanta se zaboravi pri svakoj objavi.
 */
const ENGINE_VERSION: string = (
  require("../package.json") as { version: string }
).version;
/**
 * Verzija CEN artefakata, pročitana iz onoga što je build stvarno pripremio.
 *
 * Bila je zakucana, a `build-sef.mjs` dopušta `CEN_TAG` override - build s
 * drugim tagom bi proizveo izvještaj koji tvrdi da su izvršena pravila koja
 * nisu. `profiles[].version` je jedini razlog zbog kojeg izvještaj može služiti
 * kao audit trag, pa je pogrešna vrijednost gora od nikakve.
 */
function readArtefactInfo(): { version: string; source: string } {
  try {
    const path = fileURLToPath(new URL("../sef/artefacts.json", import.meta.url));
    const meta = JSON.parse(readFileSync(path, "utf-8")) as {
      en16931?: { version?: string; source?: string };
    };
    if (meta.en16931?.version) {
      return {
        version: meta.en16931.version,
        source: meta.en16931.source ?? "CEN/TC 434",
      };
    }
  } catch {
    // stariji build bez metapodataka
  }
  return { version: "unknown", source: "CEN/TC 434" };
}

const ARTEFACTS = readArtefactInfo();

const BASE_SEF: Record<Syntax, string> = {
  ubl: fileURLToPath(new URL("../sef/en16931-ubl.sef.json", import.meta.url)),
  cii: fileURLToPath(new URL("../sef/en16931-cii.sef.json", import.meta.url)),
};

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

// "serialized", ne "document": Saxonov DOM nema getElementsByTagNameNS, a
// parseSvrl treba jedan DOM.
const NODE_RUNTIME: EngineRuntime = {
  engineVersion: ENGINE_VERSION,
  artefacts: ARTEFACTS,
  baseSef: BASE_SEF,
  loadSef: async (sefPath) => loadSef(sefPath),
  async transform(sef, xml) {
    const SaxonJS = require("saxon-js");
    const result = await SaxonJS.transform(
      { stylesheetInternal: sef, sourceText: xml, destination: "serialized" },
      "async",
    );
    return result.principalResult as string;
  },
  parseXml(text) {
    const { DOMParser } = require("@xmldom/xmldom");
    const doc = new DOMParser({
      onError: (level: string, msg: string) => {
        if (level === "error" || level === "fatalError") throw new Error(msg);
      },
    }).parseFromString(text, "text/xml") as unknown as Document;
    if (!doc?.documentElement) throw new Error("dokument nema korijenski element");
    return doc;
  },
};

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
  return runValidation(xml, opts, NODE_RUNTIME);
}

/**
 * Kodiranja koja Node dekodira izvorno. Za ostalo je bolje odbiti nego tiho
 * proizvesti mojibake.
 */
const SUPPORTED_ENCODINGS = new Set(["utf-8", "utf8", "us-ascii", "ascii"]);

/**
 * Kao `validate`, ali čita dokument s diska.
 *
 * Poštuje `encoding` iz XML deklaracije. Ranije se sve čitalo kao UTF-8, pa je
 * ISO-8859-2 dokument tiho postajao mojibake (U+FFFD) i padao na naizgled
 * nepovezanim pravilima - umjesto da odmah kaže da kodiranje nije podržano.
 */
export async function validateFile(
  path: string,
  opts: ValidateOptions = {},
): Promise<ValidationReport> {
  const bytes = await readFile(path);
  const head = bytes.subarray(0, 200).toString("latin1");
  const declared = /<\?xml[^>]*\bencoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1];

  if (declared && !SUPPORTED_ENCODINGS.has(declared.toLowerCase())) {
    throw new Error(
      `Dokument deklariše kodiranje "${declared}", koje nije podržano. ` +
        `Pretvori ga u UTF-8 prije validacije.`,
    );
  }
  return validate(bytes.toString("utf-8"), opts);
}
