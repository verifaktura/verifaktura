import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../../src/validate.js";
import { registerProfile, resolveProfiles } from "../../src/profiles.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const valid = readFileSync(join(FIX, "invoice-valid.xml"), "utf-8");

describe("otpornost na ulaz", () => {
  /**
   * Regresija: datoteke iz Windows alata redovno nose UTF-8 BOM. Parser je na
   * njemu pucao prije nego što dođe do sadržaja, pa je ispravan dokument bio
   * odbijen s nejasnom greškom (CLI izlazni kod 2) umjesto da se validira.
   */
  it("validira dokument s UTF-8 BOM-om", async () => {
    const r = await validate("﻿" + valid);
    expect(r.valid).toBe(true);
  });

  it("na neispravnom XML-u daje razumljivu grešku", async () => {
    await expect(validate("<Invoice><nezatvoren>")).rejects.toThrow(
      /Nije moguće parsirati/,
    );
  });

  it("na praznom ulazu ne propušta ParseError iz parsera", async () => {
    await expect(validate("")).rejects.toThrow(/Nije moguće parsirati/);
  });
});

describe("odabir profila", () => {
  registerProfile({
    id: "samo-ubl",
    label: "Test",
    version: "1",
    source: "test",
    syntax: ["ubl"],
    matches: () => false,
    sefPath: "/nepostojeci.sef.json",
  });

  /**
   * Regresija: eksplicitno traženi profil je zaobilazio provjeru sintakse, pa
   * bi UBL profil nad CII dokumentom izvršio nula pravila, a u izvještaju bi
   * stajao kao da je validirao.
   */
  it("odbija profil koji ne pokriva sintaksu dokumenta", () => {
    expect(() => resolveProfiles(undefined, "cii", ["samo-ubl"])).toThrow(
      /pokriva UBL/,
    );
  });

  it("prihvata ga za sintaksu koju pokriva", () => {
    expect(resolveProfiles(undefined, "ubl", ["samo-ubl"]).map((p) => p.id)).toEqual([
      "samo-ubl",
    ]);
  });
});
