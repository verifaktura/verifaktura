import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../src/validate.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const xml = readFileSync(join(FIX, "invoice-missing-id-date.xml"), "utf-8");

/**
 * Regresija: sažetak i `valid` su se računali iz skraćenog popisa, pa je fatalni
 * nalaz iza granice pretvarao dokument u valid:true. Uz to se `maxIssues: 0`
 * tretirao kao "bez limita" zbog provjere na istinitost.
 */
describe("maxIssues", () => {
  it("ne mijenja verdikt ni brojeve", async () => {
    const pun = await validate(xml);
    const kratki = await validate(xml, { maxIssues: 1 });

    expect(pun.summary.fatal).toBeGreaterThan(1);
    expect(kratki.summary.fatal).toBe(pun.summary.fatal);
    expect(kratki.valid).toBe(pun.valid);
    expect(kratki.valid).toBe(false);
  });

  it("skraćuje popis i označava da je skraćen", async () => {
    const r = await validate(xml, { maxIssues: 1 });
    expect(r.issues).toHaveLength(1);
    expect(r.truncated).toBe(true);
  });

  it("nula znači samo sažetak, ne izostanak limita", async () => {
    const r = await validate(xml, { maxIssues: 0 });
    expect(r.issues).toHaveLength(0);
    expect(r.summary.fatal).toBeGreaterThan(0);
    expect(r.valid).toBe(false);
    expect(r.truncated).toBe(true);
  });

  it("bez limita vraća sve", async () => {
    const r = await validate(xml);
    expect(r.truncated).toBeUndefined();
    expect(r.issues.length).toBe(r.summary.fatal + r.summary.warning + r.summary.info);
  });
});
