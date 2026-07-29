import { describe, it, expect } from "vitest";
import { isValidOib, oibFromVatId, assertValidOib } from "../src/oib.js";

describe("OIB", () => {
  it("prihvata ispravne brojeve", () => {
    expect(isValidOib("12345678903")).toBe(true);
    expect(isValidOib("98765432106")).toBe(true);
  });

  it("odbija pogrešnu kontrolnu znamenku", () => {
    expect(isValidOib("12345678901")).toBe(false);
    expect(isValidOib("98765432104")).toBe(false);
  });

  it("odbija pogrešnu dužinu i nebrojčane vrijednosti", () => {
    expect(isValidOib("1234567890")).toBe(false);
    expect(isValidOib("123456789012")).toBe(false);
    expect(isValidOib("HR12345678903")).toBe(false);
    expect(isValidOib("")).toBe(false);
  });

  it("izvlači OIB iz hrvatskog PDV identifikatora", () => {
    expect(oibFromVatId("HR12345678903")).toBe("12345678903");
    expect(oibFromVatId("hr12345678903")).toBe("12345678903");
    expect(oibFromVatId("DE123456789")).toBeUndefined();
    expect(oibFromVatId(undefined)).toBeUndefined();
  });

  it("assertValidOib daje upotrebljivu poruku", () => {
    expect(() => assertValidOib("12345678901", "OIB operatera")).toThrow(
      /OIB operatera "12345678901" nije ispravan/,
    );
  });
});
