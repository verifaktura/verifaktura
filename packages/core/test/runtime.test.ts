import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { runValidation, type EngineRuntime } from "../src/engine.js";
import { registerProfile } from "../src/profiles.js";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const INVOICE = readFileSync(join(FIX, "invoice-valid.xml"), "utf-8");
const SVRL_FAIL = readFileSync(join(FIX, "svrl-br02-br03.xml"), "utf-8");
const SVRL_EMPTY = `<svrl:schematron-output xmlns:svrl="http://purl.oclc.org/dsdl/svrl"/>`;

const PROFILE_ID = "urn:test:runtime:1.0";
registerProfile({
  id: "rt-test",
  label: "Runtime test",
  version: "1",
  source: "test",
  syntax: ["ubl"],
  matches: (id) => id === PROFILE_ID,
  sefPath: "https://example.test/rt.sef.json",
  overrides: ["BR-03"],
});

/** Runtime bez Saxona: SEF je ime lokatora, SVRL dolazi iz mape. */
function fakeRuntime(svrlBySef: Record<string, string>) {
  const loaded: string[] = [];
  const rt: EngineRuntime = {
    engineVersion: "9.9.9",
    artefacts: { version: "validation-test", source: "test-src" },
    baseSef: { ubl: "base-ubl", cii: "base-cii" },
    loadSef: async (locator) => {
      loaded.push(locator);
      return locator;
    },
    transform: async (sef) => svrlBySef[sef as string] ?? SVRL_EMPTY,
    parseXml: (text) => {
      const doc = new DOMParser({
        onError: (level: string, msg: string) => {
          if (level === "fatalError") throw new Error(msg);
        },
      }).parseFromString(text, "text/xml") as unknown as Document;
      if (!doc?.documentElement) throw new Error("bez korijena");
      return doc;
    },
  };
  return { rt, loaded };
}

describe("runValidation s ubrizganim runtimeom", () => {
  it("izvještaj nosi verziju engine-a i artefakata iz runtimea", async () => {
    const { rt, loaded } = fakeRuntime({});
    const r = await runValidation(INVOICE, {}, rt);
    expect(r.engine).toBe("verifaktura/9.9.9");
    expect(r.profiles).toEqual([{ id: "en16931", version: "validation-test", source: "test-src" }]);
    expect(loaded).toEqual(["base-ubl"]);
    expect(r.valid).toBe(true);
  });

  it("nalazi iz runtimeovog SVRL-a obaraju dokument", async () => {
    const { rt } = fakeRuntime({ "base-ubl": SVRL_FAIL });
    const r = await runValidation(INVOICE, { lang: "hr" }, rt);
    expect(r.valid).toBe(false);
    expect(r.issues.map((i) => i.ruleId)).toEqual(expect.arrayContaining(["BR-02", "BR-03"]));
  });

  it("profil se učitava preko svog lokatora i nadjačava osnovna pravila", async () => {
    const { rt, loaded } = fakeRuntime({ "base-ubl": SVRL_FAIL });
    const xml = INVOICE.replace("urn:cen.eu:en16931:2017<", `${PROFILE_ID}<`);
    const r = await runValidation(xml, {}, rt);
    expect(loaded).toEqual(["base-ubl", "https://example.test/rt.sef.json"]);
    expect(r.profiles.map((p) => p.id)).toEqual(["en16931", "rt-test"]);
    expect(r.issues.find((i) => i.ruleId === "BR-03")?.severity).toBe("info");
    expect(r.issues.find((i) => i.ruleId === "BR-02")?.severity).toBe("fatal");
  });

  it("greška parsera dobija kontekst", async () => {
    const { rt } = fakeRuntime({});
    await expect(runValidation("<Invoice", {}, rt)).rejects.toThrow(
      /^Nije moguće parsirati XML dokument: /,
    );
  });
});
