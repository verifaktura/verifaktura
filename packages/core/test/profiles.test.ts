import { describe, it, expect, beforeEach } from "vitest";
import { registerProfile, listProfiles, resolveProfiles, type ProfileDefinition } from "../src/profiles.js";

const HR_ID =
  "urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0" +
  "#conformant#urn:mfin.gov.hr:ext[1]2025:1.0";

const fake: ProfileDefinition = {
  id: "test-hr",
  label: "Test HR",
  version: "1.0",
  source: "test",
  syntax: ["ubl"],
  matches: (id) => id === HR_ID,
  sefPath: "/nepostojeci/put.sef.json",
};

describe("registar profila", () => {
  beforeEach(() => registerProfile(fake));

  it("registruje profil", () => {
    expect(listProfiles().map((p) => p.id)).toContain("test-hr");
  });

  it("automatski bira profil po CustomizationID", () => {
    expect(resolveProfiles(HR_ID, "ubl").map((p) => p.id)).toContain("test-hr");
  });

  it("ne bira profil za čisti EN 16931 dokument", () => {
    expect(resolveProfiles("urn:cen.eu:en16931:2017", "ubl")).toEqual([]);
  });

  it("ne bira UBL profil za CII dokument", () => {
    expect(resolveProfiles(HR_ID, "cii")).toEqual([]);
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
