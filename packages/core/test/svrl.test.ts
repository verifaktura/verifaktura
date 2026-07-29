import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { parseSvrl, extractBusinessTerms, stripRulePrefix } from "../src/svrl.js";
import { detectSyntax, summarizeUbl } from "../src/detect.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const read = (f: string) => readFileSync(join(FIX, f), "utf-8");
const parse = (s: string) => new DOMParser().parseFromString(s, "text/xml") as unknown as Document;

describe("parseSvrl", () => {
  const doc = parse(read("svrl-br02-br03.xml"));
  const { issues, rulesFired } = parseSvrl(doc, "en16931", "bs");

  it("prepoznaje sve failed-assert nalaze", () => {
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.ruleId)).toEqual(["BR-02", "BR-03"]);
  });

  it("mapira flag=fatal u severity fatal", () => {
    expect(issues.every((i) => i.severity === "fatal")).toBe(true);
  });

  it("izvlači business termove iz teksta pravila", () => {
    expect(issues[0].businessTerms).toContain("BT-1");
    expect(issues[1].businessTerms).toContain("BT-2");
  });

  it("vraća lokalizovanu poruku kad postoji u katalogu", () => {
    expect(issues[0].message).toBe("Faktura mora sadržavati broj fakture (BT-1).");
    expect(issues[0].messages.hr).toBe("Račun mora sadržavati broj računa (BT-1).");
  });

  it("broji izvršena pravila", () => {
    expect(rulesFired).toBeGreaterThan(0);
  });

  it("puni XPath lokaciju", () => {
    expect(issues[0].location.xpath).toContain("Invoice");
  });
});

describe("pomoćne funkcije", () => {
  it("stripRulePrefix skida [BR-xx]- prefiks", () => {
    expect(stripRulePrefix("[BR-02]-An Invoice shall have an Invoice number (BT-1).")).toBe(
      "An Invoice shall have an Invoice number (BT-1).",
    );
  });

  it("extractBusinessTerms hvata BT i BG reference bez duplikata", () => {
    expect(extractBusinessTerms("... (BT-1) ... BG-25 ... (BT-1)")).toEqual(["BT-1", "BG-25"]);
  });
});

describe("detekcija dokumenta", () => {
  const doc = parse(read("invoice-valid.xml"));

  it("prepoznaje UBL fakturu", () => {
    expect(detectSyntax(doc)).toEqual({ syntax: "ubl", type: "invoice" });
  });

  it("izvlači sažetak dokumenta", () => {
    const s = summarizeUbl(doc);
    expect(s.id).toBeTruthy();
    expect(s.currency).toBeTruthy();
    expect(s.customizationId).toContain("en16931");
  });

  it("baca grešku na nepoznatu sintaksu", () => {
    expect(() => detectSyntax(parse("<foo/>"))).toThrow(/Nepoznata sintaksa/);
  });
});

describe("bosanskohercegovačka faktura (stvarni slučaj)", () => {
  const doc = parse(read("invoice-ba-bam.xml"));

  it("prepoznaje BAM valutu i BiH strane", () => {
    const s = summarizeUbl(doc);
    expect(s.currency).toBe("BAM");
    expect(s.id).toBe("52430-1/2026");
    expect(s.payableAmount).toBe("9.36");
  });

  it("PDV broj bez prefiksa države pada na BR-CO-09", () => {
    // Bh. PDV broj (npr. 210300400000) nema ISO 3166-1 alpha-2 prefiks koji
    // EN 16931 zahtijeva. Ovo je sistemska razlika, ne greška u ovom dokumentu -
    // svaka bh. faktura mapirana 1:1 pada na isto pravilo.
    const vat = summarizeUbl(doc).supplier?.vatId ?? "";
    expect(vat).not.toMatch(/^[A-Z]{2}/);
  });
});
