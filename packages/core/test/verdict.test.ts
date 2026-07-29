import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { parseSvrl } from "../src/svrl.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const parse = (s: string) => new DOMParser().parseFromString(s, "text/xml") as unknown as Document;

const SVRL_BEZ_FLAGA = `<?xml version="1.0"?>
<svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl">
  <svrl:fired-rule context="/*"/>
  <svrl:failed-assert id="X-BR-1" location="/*:Invoice[1]">
    <svrl:text>[X-BR-1]-Nesto obavezno nedostaje.</svrl:text>
  </svrl:failed-assert>
  <svrl:successful-report id="X-INFO-1" location="/*:Invoice[1]">
    <svrl:text>[X-INFO-1]-Napomena.</svrl:text>
  </svrl:successful-report>
</svrl:schematron-output>`;

/**
 * Regresija: `flag` je u Schematronu opcion. Ranije se izostavljen flag mapirao
 * na `info`, pa bi profil čiji schematron ne postavlja flag imao sve greške
 * spuštene na informativne i dokument bi ispao validan.
 */
describe("ozbiljnost bez @flag", () => {
  const { issues } = parseSvrl(parse(SVRL_BEZ_FLAGA), "test", "bs");

  it("failed-assert bez flaga je fatal, ne info", () => {
    expect(issues.find((i) => i.ruleId === "X-BR-1")?.severity).toBe("fatal");
  });

  it("successful-report bez flaga ostaje info", () => {
    expect(issues.find((i) => i.ruleId === "X-INFO-1")?.severity).toBe("info");
  });

  it("poznati flagovi se i dalje poštuju", () => {
    const doc = parse(readFileSync(join(FIX, "svrl-br02-br03.xml"), "utf-8"));
    const r = parseSvrl(doc, "en16931", "bs");
    expect(r.issues.every((i) => i.severity === "fatal")).toBe(true);
  });
});
