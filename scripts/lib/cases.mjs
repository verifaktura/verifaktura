/**
 * Zajednički pokretač test slučajeva za e2e i round-trip.
 *
 * Oba skripta su imala vlastitu petlju s istim ispisom i istom logikom
 * izlaznog koda; razlika je bila samo u tome odakle dolazi dokument.
 */

/**
 * @param {string} naslov
 * @param {{name: string, run: () => Promise<{ok: boolean, detail?: string, note?: string}>}[]} cases
 */
export async function runCases(naslov, cases) {
  let failed = 0;

  for (const c of cases) {
    const r = await c.run();
    if (r.ok) {
      console.log(`ok   ${c.name}${r.note ? ` (${r.note})` : ""}`);
    } else {
      failed++;
      console.error(`FAIL ${c.name}`);
      for (const line of (r.detail ?? "").split("\n").filter(Boolean)) {
        console.error(`     ${line}`);
      }
    }
  }

  console.log();
  if (failed) {
    console.error(`${failed} od ${cases.length} — ${naslov}`);
    process.exit(1);
  }
  console.log(`Svih ${cases.length} — ${naslov}`);
}

/** Sažetak nalaza za ispis pri padu. */
export function formatIssues(issues) {
  return issues
    .filter((i) => i.severity !== "info")
    .map((i) => `${i.severity.toUpperCase()} ${i.ruleId}: ${i.message.slice(0, 100)}`)
    .join("\n");
}
