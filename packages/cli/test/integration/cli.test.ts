import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dist", "cli.js");
const FIX = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "core", "test", "fixtures",
);

/** Pokreće CLI i vraća izlaz s kodom, umjesto da baci na ne-nula kod. */
async function cli(...args: string[]): Promise<{ code: number; out: string; err: string }> {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args]);
    return { code: 0, out: stdout, err: stderr };
  } catch (e) {
    const x = e as { code?: number; stdout?: string; stderr?: string };
    return { code: x.code ?? 1, out: x.stdout ?? "", err: x.stderr ?? "" };
  }
}

/**
 * CLI je jedini paket koji se objavljivao bez ijednog testa, a najvjerojatnije
 * je prva stvar koju integrator isproba.
 */
describe("CLI", () => {
  it("validan dokument daje izlazni kod 0", async () => {
    const r = await cli(join(FIX, "invoice-valid.xml"));
    expect(r.code).toBe(0);
    expect(r.out).toContain("VALIDNO");
  });

  it("nevalidan dokument daje izlazni kod 1", async () => {
    const r = await cli(join(FIX, "invoice-missing-id-date.xml"));
    expect(r.code).toBe(1);
    expect(r.out).toContain("BR-02");
  });

  it("--quiet ne ispisuje ništa", async () => {
    const r = await cli(join(FIX, "invoice-valid.xml"), "--quiet");
    expect(r.code).toBe(0);
    expect(r.out.trim()).toBe("");
  });

  it("--format json daje parsabilan izvještaj", async () => {
    const r = await cli(join(FIX, "invoice-valid.xml"), "--format", "json");
    const report = JSON.parse(r.out);
    expect(report.reportVersion).toBe("1.0");
    expect(report.valid).toBe(true);
  });

  it("sažetak navodi koji su profili izvršeni", async () => {
    const r = await cli(join(FIX, "invoice-valid.xml"));
    expect(r.out).toMatch(/profili: en16931/);
  });

  /** Regresija: `--lang racun.xml` je progutao datoteku kao vrijednost jezika. */
  it("odbija nepoznatu vrijednost opcije umjesto da proguta datoteku", async () => {
    const r = await cli("--lang", join(FIX, "invoice-valid.xml"));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/Nepoznat jezik/);
  });

  it("podržava --opcija=vrijednost", async () => {
    const r = await cli(join(FIX, "invoice-valid.xml"), "--lang=bs");
    expect(r.code).toBe(0);
  });

  it("bez argumenata ispisuje pomoć i izlazi s 2", async () => {
    const r = await cli();
    expect(r.code).toBe(2);
    expect(r.out).toContain("verifaktura <fajl.xml>");
  });

  it("--help izlazi s 0", async () => {
    const r = await cli("--help");
    expect(r.code).toBe(0);
  });

  it("nepostojeća datoteka daje kod 2 s razumljivom porukom", async () => {
    const r = await cli("/nema/ovoga.xml");
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/Greška/);
  });
});
