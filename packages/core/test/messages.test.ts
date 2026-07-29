import { describe, it, expect } from "vitest";
import { messagesFor, pickMessage, catalogStats } from "../src/messages.js";
import CATALOG from "../src/catalog/rules.json" with { type: "json" };

const RULES = CATALOG as unknown as Record<string, { en: string; hr?: string; bs?: string; sr?: string }>;

describe("katalog poruka", () => {
  const stats = catalogStats();

  it("pokriva sva EN 16931 business pravila (BR-*)", () => {
    expect(stats.businessRulesLocalized).toBe(stats.businessRules);
    expect(stats.businessRules).toBeGreaterThan(200);
  });

  it("svako lokalizovano pravilo ima sva tri jezika", () => {
    const nepotpuna = Object.entries(RULES)
      .filter(([, v]) => v.bs && !(v.hr && v.sr))
      .map(([k]) => k);
    expect(nepotpuna).toEqual([]);
  });

  it("nijedna lokalizovana poruka nije prazna ili duplikat engleske", () => {
    const lose = Object.entries(RULES)
      .filter(([, v]) => v.bs !== undefined && (v.bs.trim().length < 10 || v.bs === v.en))
      .map(([k]) => k);
    expect(lose).toEqual([]);
  });

  it("fallback na engleski za pravila van kataloga", () => {
    const m = messagesFor("NEPOSTOJECE-01", "Some English text.");
    expect(m).toEqual({ en: "Some English text." });
    expect(pickMessage(m, "bs")).toBe("Some English text.");
  });

  it("pickMessage bira traženi jezik", () => {
    const m = messagesFor("BR-02", "");
    expect(pickMessage(m, "hr")).toContain("Račun");
    expect(pickMessage(m, "bs")).toContain("Faktura");
    expect(pickMessage(m, "en")).toContain("Invoice number");
  });
});

/**
 * Regresijski test za stvarni bug: šabloni za PDV porodice imali su isti tekst
 * za sufikse 09 i 10 bez obzira na kategoriju, iako se semantika INVERTIRA -
 * kod oporezivih kategorija razlog oslobođenja je ZABRANJEN, a kod oslobođenih
 * je OBAVEZAN. Pogrešna poruka ovdje je gora od nikakve.
 */
describe("semantika PDV kategorija (regresija)", () => {
  const ZABRANJEN = ["BR-S-10", "BR-Z-10", "BR-AF-10", "BR-AG-10"];
  const OBAVEZAN = ["BR-E-10", "BR-AE-10", "BR-G-10", "BR-IC-10", "BR-O-10"];
  const NULA = ["BR-AE-09", "BR-G-09", "BR-IC-09", "BR-O-09"];

  it.each(ZABRANJEN)("%s zabranjuje razlog oslobođenja", (id) => {
    expect(RULES[id].bs).toMatch(/ne smije imati razlog oslobođenja/);
    expect(RULES[id].en).toMatch(/shall not have a VAT exemption/i);
  });

  it.each(OBAVEZAN)("%s zahtijeva razlog oslobođenja", (id) => {
    expect(RULES[id].bs).toMatch(/mora imati šifru razloga oslobođenja/);
    expect(RULES[id].en).toMatch(/shall have a VAT exemption/i);
  });

  it.each(NULA)("%s traži iznos PDV-a jednak nuli", (id) => {
    expect(RULES[id].bs).toMatch(/mora biti 0/);
    expect(RULES[id].en).toMatch(/shall be 0/i);
  });

  // Isti obrazac inverzije javlja se i na sufiksima 02/03/04: kod većine
  // kategorija je porezni identifikator prodavca OBAVEZAN, kod "O" je ZABRANJEN.
  const ID_OBAVEZAN = ["BR-S-02", "BR-Z-02", "BR-E-02", "BR-AE-02", "BR-G-02", "BR-IC-02"];
  const ID_ZABRANJEN = ["BR-O-02", "BR-O-03", "BR-O-04"];

  it.each(ID_OBAVEZAN)("%s traži porezni identifikator", (id) => {
    expect(RULES[id].bs).toMatch(/mora sadržavati PDV broj prodavca/);
    expect(RULES[id].en).toMatch(/shall contain the Seller VAT/i);
  });

  it.each(ID_ZABRANJEN)("%s zabranjuje porezni identifikator", (id) => {
    expect(RULES[id].bs).toMatch(/NE SMIJE sadržavati PDV broj prodavca/);
    expect(RULES[id].en).toMatch(/shall not contain the Seller VAT/i);
  });

  it("BR-S-09 računa PDV, ne postavlja ga na nulu", () => {
    expect(RULES["BR-S-09"].bs).toMatch(/pomnoženoj sa stopom/);
    expect(RULES["BR-S-09"].bs).not.toMatch(/mora biti 0/);
  });
});
