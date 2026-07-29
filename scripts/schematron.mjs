/**
 * Kompajliranje sirovog ISO Schematrona u SEF (Saxon Executable Format).
 *
 * CEN isporučuje već prekompajlirani XSLT, ali nacionalni izvori (npr. Porezna
 * uprava RH) isporučuju sirovi .sch. Za njih treba proći standardni ISO lanac:
 *
 *   1. razrješavanje <sch:include>   <- radimo u JS-u, ne skeletonom (vidi dolje)
 *   2. iso_abstract_expand.xsl       <- širi apstraktne patterne
 *   3. iso_svrl_for_xslt2.xsl        <- generiše XSLT koji proizvodi SVRL
 *   4. xslt3 -export                 <- kompajlira u SEF
 *
 * Zašto korak 1 nije iso_dsdl_include.xsl: taj skeleton pada na
 * "Maximum call stack size exceeded" pod Saxon-JS, a podizanje Node stacka
 * dovodi do segfaulta. Od svih DSDL funkcija treba nam samo <include>, pa je
 * jednostavnije i pouzdanije razriješiti ga direktno.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const SCH_NS = "http://purl.oclc.org/dsdl/schematron";
const SKELETON_REPO = "https://github.com/schematron/schematron.git";
const SKELETON_STAGES = ["iso_abstract_expand", "iso_svrl_for_xslt2"];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });

/**
 * Rekurzivno ugrađuje <sch:include href="..."> na mjesto elementa.
 * Semantika je ISO: include se zamjenjuje korijenskim elementom ciljnog
 * dokumenta (kod Schematrona je to obično <pattern>).
 */
export function resolveIncludes(schPath, depth = 0) {
  if (depth > 20) throw new Error(`Prevelika dubina <include>: ${schPath}`);
  const doc = new DOMParser().parseFromString(readFileSync(schPath, "utf-8"), "text/xml");
  const base = dirname(schPath);
  let includes = doc.getElementsByTagNameNS(SCH_NS, "include");
  while (includes.length > 0) {
    const el = includes[0];
    const href = el.getAttribute("href");
    if (!href) throw new Error(`<include> bez href u ${schPath}`);
    const target = resolveIncludes(resolve(base, href), depth + 1);
    el.parentNode.replaceChild(doc.importNode(target.documentElement, true), el);
    includes = doc.getElementsByTagNameNS(SCH_NS, "include");
  }
  return doc;
}

/** Klonira ISO Schematron skeleton (MIT) i kompajlira potrebne faze u SEF. */
export function prepareSkeleton(vendorDir) {
  const repo = join(vendorDir, "schematron");
  if (!existsSync(repo)) {
    console.log("Preuzimam ISO Schematron skeleton...");
    mkdirSync(vendorDir, { recursive: true });
    run("git", ["clone", "--depth", "1", SKELETON_REPO, repo]);
  }
  const code = join(repo, "trunk", "schematron", "code");
  const out = join(vendorDir, "skeleton-sef");
  mkdirSync(out, { recursive: true });

  const stages = {};
  for (const stage of SKELETON_STAGES) {
    const sef = join(out, `${stage}.sef.json`);
    if (!existsSync(sef)) {
      console.log(`Kompajliram skeleton: ${stage}`);
      run("npx", ["xslt3", `-xsl:${join(code, `${stage}.xsl`)}`, `-export:${sef}`, "-nogo"]);
    }
    stages[stage] = sef;
  }
  return stages;
}

/**
 * Kompajlira .sch u SEF.
 *
 * @param {string} schPath  putanja do sirovog Schematrona
 * @param {string} sefPath  gdje snimiti SEF
 * @param {string} workDir  direktorij za međukorake
 * @param {Record<string,string>} stages  rezultat prepareSkeleton()
 */
export function compileSchematron(schPath, sefPath, workDir, stages) {
  mkdirSync(workDir, { recursive: true });
  mkdirSync(dirname(sefPath), { recursive: true });

  const included = join(workDir, "1-included.sch");
  const expanded = join(workDir, "2-expanded.sch");
  const generated = join(workDir, "3-generated.xslt");

  writeFileSync(included, new XMLSerializer().serializeToString(resolveIncludes(schPath)), "utf-8");
  run("npx", ["xslt3", `-xsl:${stages.iso_abstract_expand}`, `-s:${included}`, `-o:${expanded}`]);
  run("npx", ["xslt3", `-xsl:${stages.iso_svrl_for_xslt2}`, `-s:${expanded}`, `-o:${generated}`]);
  run("npx", ["xslt3", `-xsl:${generated}`, `-export:${sefPath}`, "-nogo"]);
  return sefPath;
}
