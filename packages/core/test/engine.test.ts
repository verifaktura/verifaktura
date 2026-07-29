import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Regresija: ENGINE_VERSION je bio zakucan na "0.1.0" i ostao takav kroz sedam
 * objava, pa je svaki izvještaj tvrdio pogrešnu verziju engine-a. Izvještaj se
 * koristi kao audit trag — netačna oznaka mu obara svrhu.
 */
describe("verzija engine-a", () => {
  it("čita se iz package.json, nije zakucana", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
    const src = readFileSync(join(root, "src", "validate.ts"), "utf-8");

    expect(src).not.toMatch(/ENGINE_VERSION\s*=\s*"[\d.]+"/);
    expect(src).toMatch(/require\("\.\.\/package\.json"\)/);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
