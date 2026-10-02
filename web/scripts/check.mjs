#!/usr/bin/env node
/**
 * Provjera izgrađenog web/dist u pravom pregledniku (headless Chrome, CDP).
 *
 * Za svaki dokument poredi nalaze sa stranice s Node `validate()`; uz to
 * provjerava da se sadržaj dokumenta ispisuje kao tekst, da CSP ništa ne
 * blokira i da se ISO-8859-2 datoteka dekodira.
 *
 *   CHROME=/putanja/do/chrome node web/scripts/check.mjs
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildUbl } from "@verifaktura/build";
import { validate } from "verifaktura";
import { HR_CUSTOMIZATION_ID } from "@verifaktura/cius-hr";
import { hrSeller, hrBuyer, HR_IBAN } from "../../scripts/lib/parties.mjs";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(WEB, "..");
const DIST = join(WEB, "dist");

const CHROME =
  process.env.CHROME ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"]
    .find((p) => existsSync(p));
if (!CHROME) throw new Error("Chrome nije pronađen; postavi CHROME=...");
if (!existsSync(join(DIST, "index.html"))) throw new Error("Nema web/dist; pokreni `npm run build:web`.");

const HOSTILE_ID = `<img src=x onerror="window.__xss=1">"'&`;
const hrInvoice = buildUbl({
  customizationId: HR_CUSTOMIZATION_ID,
  profileId: "P1",
  id: "2026-001",
  issueDate: "2026-07-29",
  issueTime: "10:15:00",
  dueDate: "2026-08-28",
  currency: "EUR",
  seller: hrSeller,
  buyer: hrBuyer,
  paymentMeans: { code: "30", accountId: HR_IBAN },
  lines: [{
    name: "Usluga razvoja softvera", quantity: "10", unitPrice: "80.00",
    vatCategory: "S", vatRate: "25", unitCode: "HUR", vatCategoryName: "HR:PDV25",
    classification: { value: "62.10.11", scheme: "CG" },
  }],
});
const fixture = (p) => readFileSync(join(ROOT, p), "utf-8");
const valid = fixture("packages/core/test/fixtures/invoice-valid.xml");

const CASES = [
  { name: "UBL bez greške", xml: valid },
  { name: "UBL bez broja i datuma", xml: fixture("packages/core/test/fixtures/invoice-missing-id-date.xml") },
  { name: "HR eRačun", xml: hrInvoice },
  { name: "HR eRačun bez klasifikacije", xml: hrInvoice.replace(/<cac:CommodityClassification>[\s\S]*?<\/cac:CommodityClassification>/, "") },
  { name: "CII (CEN primjer 8)", xml: fixture("vendor/cen/cii/examples/CII_example8.xml") },
  { name: "neprijateljski cbc:ID", xml: valid.replace(/<cbc:ID>[^<]*<\/cbc:ID>/, `<cbc:ID>${HOSTILE_ID.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</cbc:ID>`) },
];

// --- statični server, kao što bi ga dao hosting ------------------------------
const TYPES = { ".svg": "image/svg+xml", ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".txt": "text/plain; charset=utf-8" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(DIST, path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(DIST + sep) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

// --- Chrome + CDP -------------------------------------------------------------
const profile = mkdtempSync(join(tmpdir(), "vf-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-sandbox", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  setTimeout(() => reject(new Error("Chrome nije pokrenuo DevTools u 30 s")), 30_000).unref();
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", (c) => reject(new Error(`Chrome izašao (${c})`)));
});
const port = new URL(wsUrl).port;
const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const problems = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id) return pending.get(m.id)?.(m), pending.delete(m.id);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.push(m.params.entry.text);
  if (m.method === "Runtime.consoleAPICalled" && ["warning", "error"].includes(m.params.type)) {
    problems.push(`console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  }
  if (m.method === "Runtime.exceptionThrown") problems.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP ${method}: nema odgovora 60 s (tab pao?)`));
    }, 60_000);
    pending.set(id, (m) => {
      clearTimeout(timer);
      if (m.error) reject(new Error(`CDP ${method}: ${m.error.message}`));
      else resolve(m);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
  return r.result?.result?.value;
};
const until = async (expr, ms = 120_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ev(expr)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`isteklo: ${expr}`);
};

let failed = 0;
const fail = (msg) => { failed++; console.log(`FAIL ${msg}`); };

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Page.navigate", { url: `${base}?lang=sr` });
  await until("document.readyState === 'complete'");
  if ((await ev("document.getElementById('lang').value")) !== "sr") fail("?lang=sr nije postavio jezik");
  else console.log("ok   ?lang=sr bira jezik");
  await send("Page.navigate", { url: base });
  await until("document.readyState === 'complete' && !!window.SaxonJS");
  await ev("document.getElementById('lang').value = 'hr'; document.getElementById('lang').dispatchEvent(new Event('change'))");

  for (const c of CASES) {
    const expected = await validate(c.xml, { lang: "hr" });
    await ev(`document.getElementById('result').hidden = true; document.getElementById('xml').value = ${JSON.stringify(c.xml)}; document.getElementById('run').click()`);
    await until("!document.getElementById('result').hidden || document.getElementById('status').classList.contains('error')");
    const got = await ev(`({
      error: document.getElementById('status').classList.contains('error') ? document.getElementById('status').textContent : null,
      valid: document.getElementById('verdict').classList.contains('ok'),
      issues: [...document.querySelectorAll('#issues .issue')].map((li) => [li.querySelector('.rule').textContent, li.classList[1], li.querySelector('.msg').textContent]),
      doc: [...document.querySelectorAll('#doc dd')].map((n) => n.textContent),
      imgs: document.querySelectorAll('main img').length,
      xss: window.__xss === 1,
    })`);
    const key = (i) => `${i[0]}|${i[1]}|${i[2]}`;
    const exp = expected.issues.map((i) => [i.ruleId, i.severity, i.message]).map(key).sort();
    const act = got.issues.map(key).sort();
    if (got.error) fail(`${c.name}: greška na stranici: ${got.error}`);
    else if (got.valid !== expected.valid) fail(`${c.name}: valid ${got.valid}, Node ${expected.valid}`);
    else if (JSON.stringify(exp) !== JSON.stringify(act)) fail(`${c.name}: nalazi se razlikuju\n  Node:       ${exp.join("\n              ")}\n  preglednik: ${act.join("\n              ")}`);
    else console.log(`ok   ${c.name} (${got.issues.length} nalaza, valid=${got.valid})`);
    if (c.xml.includes("onerror")) {
      if (got.xss || got.imgs) fail(`${c.name}: sadržaj dokumenta izvršen kao HTML`);
      else if (!got.doc.includes(HOSTILE_ID)) fail(`${c.name}: broj računa nije ispisan doslovno`);
      else console.log(`ok   ${c.name}: ispisan kao tekst`);
    }
  }

  // Datoteka u ISO-8859-2: broj računa "Šđčćž" mora stići neoštećen, ne kao mojibake.
  const LATIN2_ID = "Šđčćž";
  const latin2 = valid
    .replace('encoding="UTF-8"', 'encoding="ISO-8859-2"')
    .replace(/<cbc:ID>[^<]*<\/cbc:ID>/, `<cbc:ID>${LATIN2_ID}</cbc:ID>`);
  const bytes = Array.from(latin2, (ch) => ({ Š: 0xa9, đ: 0xf0, č: 0xe8, ć: 0xe6, ž: 0xbe })[ch] ?? ch.charCodeAt(0));
  await ev(`(() => {
    const dt = new DataTransfer();
    dt.items.add(new File([new Uint8Array(${JSON.stringify(bytes)})], "latin2.xml", { type: "application/xml" }));
    const input = document.getElementById('file');
    document.getElementById('result').hidden = true;
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  })()`);
  await until("!document.getElementById('result').hidden || document.getElementById('status').classList.contains('error')");
  const latin = await ev(`({
    error: document.getElementById('status').classList.contains('error') && document.getElementById('status').textContent,
    doc: [...document.querySelectorAll('#doc dd')].map((n) => n.textContent),
  })`);
  if (latin.error) fail(`ISO-8859-2 datoteka: ${latin.error}`);
  else if (!latin.doc.includes(LATIN2_ID)) fail(`ISO-8859-2 datoteka: broj računa ${JSON.stringify(latin.doc)}, očekivan ${LATIN2_ID}`);
  else console.log("ok   ISO-8859-2 datoteka dekodirana");

  const sources = await ev("document.getElementById('sources').textContent");
  if (sources.includes("unknown")) fail(`verzija pravila nije učitana: ${sources}`);
  else console.log("ok   verzija pravila u footeru");

  const missing = CASES[1].xml;
  const srMsg = (await validate(missing, { lang: "sr" })).issues.find((i) => i.ruleId === "BR-02").message;
  await send("Page.navigate", { url: `${base}?lang=hr` });
  await until("document.readyState === 'complete' && !!window.SaxonJS");
  await ev(`(() => {
    const x = document.getElementById('xml');
    x.value = ${JSON.stringify(missing)};
    x.dispatchEvent(new Event('input'));
    document.getElementById('run').click();
  })()`);
  await until("document.getElementById('status').textContent !== ''");
  await ev("for (const v of ['en', 'sr']) { const l = document.getElementById('lang'); l.value = v; l.dispatchEvent(new Event('change')); }");
  await until("!document.getElementById('run').disabled && !document.getElementById('result').hidden");
  const msgs = await ev("[...document.querySelectorAll('#issues .msg')].map((n) => n.textContent)");
  if (!msgs.includes(srMsg)) fail(`jezik promijenjen tokom prve provjere: ${JSON.stringify(msgs)}, očekivano ${srMsg}`);
  else if (!(await ev("location.search === '?lang=sr'"))) fail("promjena jezika nije upisana u URL");
  else console.log("ok   jezik promijenjen tokom prve provjere");

  const enMsg = (await validate(missing, { lang: "en" })).issues.find((i) => i.ruleId === "BR-02").message;
  await ev("const x = document.getElementById('xml'); x.value = ''; x.dispatchEvent(new Event('input'))");
  await ev("const l = document.getElementById('lang'); l.value = 'en'; l.dispatchEvent(new Event('change'))");
  await until("!document.getElementById('run').disabled");
  const after = await ev("({ msgs: [...document.querySelectorAll('#issues .msg')].map((n) => n.textContent), hidden: document.getElementById('result').hidden })");
  if (after.hidden || !after.msgs.includes(enMsg)) fail(`promjena jezika nakon pražnjenja polja: ${JSON.stringify(after)}`);
  else console.log("ok   promjena jezika prevodi dokument iz izvještaja");

  await ev("document.getElementById('result').hidden = true; document.getElementById('sample').click()");
  await until("!document.getElementById('result').hidden || document.getElementById('status').classList.contains('error')");
  const sample = await ev("[...document.querySelectorAll('#issues .rule')].map((n) => n.textContent)");
  if (!sample.includes("BR-02")) fail(`primjer računa: očekivan BR-02, dobijeno ${JSON.stringify(sample)}`);
  else console.log("ok   primjer računa");

  if (problems.length) fail(`greške u konzoli (CSP, izuzeci):\n  ${problems.join("\n  ")}`);
} finally {
  ws.close();
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await exited;
  server.close();
  // Podprocesi Chromea pišu u profil i nakon izlaza glavnog; tmp folder nije bitan.
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  } catch { /* ostaje u tmpdir */ }
}

if (failed) {
  console.log(`\n${failed} provjera nije prošlo`);
  process.exit(1);
}
console.log("\nweb/dist radi u pregledniku kao u Nodeu");
