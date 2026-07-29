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
    expect(() => parseAmount("osam")).toThrow(/Neispravan iznos/);
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
    expect(formatAmount(multiply("3", "0.333"))).toBe("0.99");
  });
});
