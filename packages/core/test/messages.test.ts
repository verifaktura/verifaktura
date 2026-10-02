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

/**
 * Regresija: šablon za sufikse 02-04 je svim PDV kategorijama dao isti uslov
 * (BT-31, BT-32 i/ili BT-63), a AE, IC, G, O i B traže druge podatke.
 */
describe("PDV kategorije 02-04 i BR-B: isti identifikatori stranaka kao izvornik", () => {
  // Identifikatori prodavatelja, zastupnika i kupca: tu je značenje bilo krivo.
  const PARTY = new Set(["BT-31", "BT-32", "BT-47", "BT-48", "BT-63"]);
  const ids = (t: string) => [...new Set(t.match(/\bBT-\d+\b/g) ?? [])].filter((b) => PARTY.has(b)).sort();
  const rules = Object.entries(RULES).filter(
    ([k, v]) => v.hr && (/^BR-[A-Z]{1,2}-0[234]$/.test(k) || /^BR-B-/.test(k)),
  );

  it("ima pravila za provjeru", () => {
    expect(rules.length).toBeGreaterThan(25);
  });

  for (const lang of ["hr", "bs", "sr"] as const) {
    it(`${lang}: BT-31/32/47/48/63 odgovaraju engleskom tekstu`, () => {
      const razlike = rules
        .filter(([, v]) => ids(v[lang]!).join() !== ids(v.en).join())
        .map(([k, v]) => `${k}: ${ids(v[lang]!).join(",")} != ${ids(v.en).join(",")}`);
      expect(razlike).toEqual([]);
    });
  }
});

/** Regresija: sufiks 01 je svima rekao "barem jednu", a šest kategorija traži tačno jednu. */
describe("PDV kategorije 01: tačno jedna naspram barem jedne", () => {
  const ONE = { hr: "točno jednu", bs: "tačno jednu", sr: "tačno jednu" } as const;
  const rules = Object.entries(RULES).filter(([k, v]) => /^BR-[A-Z]{1,2}-01$/.test(k) && /exactly one/i.test(v.en));

  it("ima pravila za provjeru", () => {
    expect(rules.length).toBeGreaterThan(4);
  });

  for (const lang of ["hr", "bs", "sr"] as const) {
    it(`${lang}: "exactly one" je "${ONE[lang]}"`, () => {
      expect(rules.filter(([, v]) => !v[lang]!.includes(ONE[lang])).map(([k]) => k)).toEqual([]);
    });
  }
});

describe("srpske poruke su ekavske", () => {
  it("bez smije/mjesto/vrijednost u sr", () => {
    const ijekavica = Object.entries(RULES)
      .filter(([, v]) => v.sr && /\b(smije|mjest\w*|vrijednost\w*)\b/i.test(v.sr))
      .map(([k]) => k);
    expect(ijekavica).toEqual([]);
  });
});

/**
 * Regresija: 05-07 su svima rekli "stopa veća od nule", a Z/E/AE/G/IC traže 0,
 * AF/AG 0 ili više, O zabranjuje stopu; 08 za S/AF/AG ide po stopi; 09 za Z i E traži PDV 0.
 */
describe("PDV kategorije 05-09: isti smisao kao izvornik", () => {
  const MEANING: [RegExp, Record<"hr" | "bs" | "sr", string>][] = [
    [/shall be 0 \(zero\) or greater than zero/i, { hr: "0 ili veća od nule", bs: "0 ili veća od nule", sr: "0 ili veća od nule" }],
    [/shall not contain an? .*VAT rate/i, { hr: "ne smije", bs: "ne smije", sr: "ne sme" }],
    [/(shall be|shall equal) 0 \(zero\)/i, { hr: "mora biti 0", bs: "mora biti 0", sr: "mora da bude 0" }],
    [/greater than zero/i, { hr: "veća od nule", bs: "veća od nule", sr: "veća od nule" }],
    [/For each different value of VAT category rate/i, { hr: "Za svaku stopu", bs: "Za svaku stopu", sr: "Za svaku stopu" }],
  ];
  const rules = Object.entries(RULES).filter(([k]) => /^BR-[A-Z]{1,2}-(0[5-9])$/.test(k));

  for (const lang of ["hr", "bs", "sr"] as const) {
    it(`${lang}: stopa i iznos PDV-a odgovaraju engleskom tekstu`, () => {
      const razlike = rules.flatMap(([k, v]) => {
        const hit = MEANING.find(([re]) => re.test(v.en));
        return hit && !v[lang]!.includes(hit[1][lang]) ? [`${k}: ${v[lang]}`] : [];
      });
      expect(razlike).toEqual([]);
    });
  }
});
