import { describe, it, expect } from "vitest";
import type { ValidationReport } from "verifaktura";
import { plural, renderText } from "../src/text.js";

const GRESKA = ["greška", "greške", "grešaka"] as const;

describe("plural", () => {
  it.each([
    [1, "greška"], [2, "greške"], [4, "greške"], [5, "grešaka"],
    [11, "grešaka"], [12, "grešaka"], [14, "grešaka"],
    [21, "greška"], [22, "greške"], [25, "grešaka"],
    [101, "greška"], [111, "grešaka"], [0, "grešaka"],
  ])("bs: %i %s", (n, expected) => {
    expect(plural("bs", n, GRESKA)).toBe(expected);
  });

  it("en: jednina samo za 1", () => {
    const f = ["error", "errors", "errors"] as const;
    expect(plural("en", 1, f)).toBe("error");
    expect(plural("en", 2, f)).toBe("errors");
    expect(plural("en", 21, f)).toBe("errors");
    expect(plural("en", 0, f)).toBe("errors");
  });
});

function report(over: Partial<ValidationReport> = {}): ValidationReport {
  return {
    reportVersion: "1.0",
    engine: "verifaktura/test",
    validatedAt: "2026-10-01T00:00:00.000Z",
    valid: false,
    document: {
      syntax: "ubl",
      type: "invoice",
      currency: "BAM",
      supplier: { name: "Primjer d.o.o." },
      payableAmount: "9.36",
    },
    profiles: [{ id: "en16931", version: "1.3.16", source: "CEN/TC 434" }],
    summary: { fatal: 1, warning: 0, info: 0, rulesFired: 211, durationMs: 250 },
    issues: [
      {
        ruleId: "BR-02",
        severity: "fatal",
        profile: "en16931",
        businessTerms: ["BT-1"],
        location: { xpath: "/*:Invoice[1]" },
        message: "Faktura mora sadržavati broj fakture (BT-1).",
        messages: { en: "An Invoice shall have an Invoice number (BT-1)." },
      },
    ],
    ...over,
  } as ValidationReport;
}

describe("renderText", () => {
  it("bs: ispravna množina i bosanski izrazi", () => {
    const out = renderText(report(), "bs");
    expect(out).toContain("NEVALIDNO - 1 greška, 0 upozorenja");
    expect(out).toContain("211 pravila");
    expect(out).toContain("Izdavalac: Primjer d.o.o.");
    expect(out).toContain("Faktura (bez broja) - UBL");
    expect(out).not.toContain("grešaka, 0");
  });

  it("hr: hrvatski izrazi", () => {
    const out = renderText(report({ summary: { fatal: 3, warning: 1, info: 0, rulesFired: 1, durationMs: 9 } }), "hr");
    expect(out).toContain("Račun (bez broja)");
    expect(out).toContain("Izdavatelj:");
    expect(out).toContain("3 greške, 1 upozorenje");
    expect(out).toContain("1 pravilo,");
  });

  it("en: okvir izvještaja na engleskom", () => {
    const out = renderText(report(), "en");
    expect(out).toContain("INVALID - 1 error, 0 warnings");
    expect(out).toContain("Supplier: Primjer d.o.o.");
    expect(out).toContain("terms: BT-1");
    expect(out).not.toMatch(/GREŠKA|Izdava/);
  });

  it("termini su poravnati s porukom", () => {
    const lines = renderText(report(), "bs").split("\n");
    const issue = lines.find((l) => l.includes("BR-02"))!;
    const terms = lines.find((l) => l.includes("termini:"))!;
    expect(terms.indexOf("termini")).toBe(issue.indexOf("Faktura mora"));
  });

  it("validan dokument bez nalaza", () => {
    const out = renderText(report({ valid: true, issues: [], summary: { fatal: 0, warning: 0, info: 0, rulesFired: 211, durationMs: 250 } }), "sr");
    expect(out).toContain("Nema nalaza.");
    expect(out).toContain("VALIDNO - 0 grešaka, 0 upozorenja");
  });
});
