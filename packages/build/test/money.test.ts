import { describe, it, expect } from "vitest";
import { parseAmount, formatAmount, applyRate, multiply, sum } from "../src/money.js";

describe("aritmetika novca", () => {
  it("parsira i formatira bez gubitka", () => {
    expect(formatAmount(parseAmount("1234.56"))).toBe("1234.56");
    expect(formatAmount(parseAmount("0.01"))).toBe("0.01");
    expect(formatAmount(parseAmount("-5"))).toBe("-5.00");
  });

  it("prihvata zarez kao decimalni separator", () => {
    expect(formatAmount(parseAmount("8,00"))).toBe("8.00");
  });

  it("zaokružuje half-up na dvije decimale", () => {
    expect(formatAmount(parseAmount("1.005"))).toBe("1.01");
    expect(formatAmount(parseAmount("1.004"))).toBe("1.00");
  });

  it("odbija smeće umjesto tihog nula-rezultata", () => {
    expect(() => parseAmount("osam")).toThrow(/Neispravan broj/);
    expect(() => parseAmount("")).toThrow();
  });

  it("ne pati od float greške (0.1 + 0.2)", () => {
    expect(formatAmount(sum("0.10", "0.20"))).toBe("0.30");
    // za usporedbu: (0.1 + 0.2).toFixed(2) === "0.30" ali 0.1+0.2 !== 0.3
    expect(formatAmount(sum(...Array(10).fill("0.10")))).toBe("1.00");
  });

  it("primjenjuje PDV stopu kako traži BR-CO-17", () => {
    // 8.00 KM × 17% = 1.36 - tačno kao na stvarnoj bh. fakturi
    expect(formatAmount(applyRate(parseAmount("8.00"), "17"))).toBe("1.36");
    expect(formatAmount(applyRate(parseAmount("100.00"), "25"))).toBe("25.00");
    expect(formatAmount(applyRate(parseAmount("33.33"), "17"))).toBe("5.67");
  });

  it("množi količinu i cijenu sa zaokruživanjem", () => {
    expect(formatAmount(multiply("10", "80.00"))).toBe("800.00");
    expect(formatAmount(multiply("1.5", "9.99"))).toBe("14.99");
    // 3 x 0.333 = 0.999 -> 1.00. Raniji test je ovdje očekivao 0.99, što je
    // bio rezultat buga: oba operanda su se prvo zaokruživala na dvije
    // decimale (0.333 -> 0.33), pa je test čuvao pogrešno ponašanje.
    expect(formatAmount(multiply("3", "0.333"))).toBe("1.00");
  });

  /**
   * Regresija: cijena i količina su se zaokruživale prije množenja, pa su
   * količine s više od dvije decimale davale tiho pogrešan iznos stavke.
   */
  it("čuva preciznost količine i jedinične cijene do rezultata", () => {
    expect(formatAmount(multiply("0.001", "1000.00"))).toBe("1.00");
    expect(formatAmount(multiply("2.345", "100.00"))).toBe("234.50");
    expect(formatAmount(multiply("0.0001", "10000.00"))).toBe("1.00");
    expect(formatAmount(multiply("-2.5", "10.00"))).toBe("-25.00");
  });

  it("normalizuje zarez prije serijalizacije", async () => {
    const { normalizeDecimal } = await import("../src/money.js");
    expect(normalizeDecimal("10,50")).toBe("10.50");
    expect(normalizeDecimal("+7")).toBe("7");
    expect(() => normalizeDecimal("10.5.1")).toThrow(/Neispravan broj/);
  });
});
