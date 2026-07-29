import { describe, it, expect, beforeEach } from "vitest";
import { registerProfile, listProfiles, resolveProfiles, type ProfileDefinition } from "../src/profiles.js";

// Izmišljena oznaka: test provjerava mehanizam odabira, ne hrvatski profil.
// Ranije je ovdje stajala baš ona pokvarena "ext[1]2025" vrijednost protiv koje
// upozorava komentar u cius-hr - test bi ovjekovječio grešku.
const TEST_ID = "urn:test:profil:1.0";

const fake: ProfileDefinition = {
  id: "test-hr",
  label: "Test HR",
  version: "1.0",
  source: "test",
  syntax: ["ubl"],
  matches: (id) => id === TEST_ID,
  sefPath: "/nepostojeci/put.sef.json",
};

describe("registar profila", () => {
  beforeEach(() => registerProfile(fake));

  it("registruje profil", () => {
    expect(listProfiles().map((p) => p.id)).toContain("test-hr");
  });

  it("automatski bira profil po CustomizationID", () => {
    expect(resolveProfiles(TEST_ID, "ubl").map((p) => p.id)).toContain("test-hr");
  });

  it("ne bira profil za čisti EN 16931 dokument", () => {
    expect(resolveProfiles("urn:cen.eu:en16931:2017", "ubl")).toEqual([]);
  });

  it("ne bira UBL profil za CII dokument", () => {
    expect(resolveProfiles(TEST_ID, "cii")).toEqual([]);
  });

  it("eksplicitan zahtjev nadjačava automatski odabir", () => {
    expect(resolveProfiles("urn:cen.eu:en16931:2017", "ubl", ["test-hr"]).map((p) => p.id)).toEqual([
      "test-hr",
    ]);
  });

  it("nepoznat profil je greška s korisnom porukom", () => {
    expect(() => resolveProfiles(undefined, "ubl", ["ne-postoji"])).toThrow(
      /Nepoznat profil "ne-postoji"/,
    );
  });
});
