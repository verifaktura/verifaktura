import { registerProfile, runValidation } from "./lib/core/portable.js";
import { hrProfileBase } from "./lib/cius-hr/profile.js";

// Sve što stiže iz dokumenta (poruke, XPath, broj računa, greške parsera) ide
// u stranicu isključivo kroz textContent; innerHTML se ovdje ne koristi.

const MAX_BYTES = 10 * 1024 * 1024;
const LANGS = ["hr", "bs", "sr", "en"];

const T = {
  hr: {
    lang: "Jezik", title: "Provjera eRačuna",
    lead: "EN 16931 (UBL i CII) i hrvatski CIUS za Fiskalizaciju 2.0. Provjera se izvodi u vašem pregledniku: račun se nikamo ne šalje.",
    pasteLabel: "Zalijepite XML računa", validate: "Provjeri", chooseFile: "ili odaberite datoteku",
    privacy: "Sadržaj računa obrađuje se samo u ovom pregledniku i ne šalje se na server. Nema kolačića.",
    license: "licenca", loading: "Učitavam pravila…", running: "Provjeravam…",
    empty: "Zalijepite XML ili odaberite datoteku.",
    tooBig: (mb) => `Datoteka je veća od ${mb} MB.`,
    encoding: (e) => `Kodiranje "${e}" nije podržano. Spremite datoteku kao UTF-8.`,
    badBytes: (e) => `Datoteka nije ispravno kodirana kao ${e}.`,
    valid: "Račun je ispravan", invalid: "Račun nije ispravan",
    fatal: "Greška", warning: "Upozorenje", info: "Napomena",
    invoice: "Račun", creditNote: "Odobrenje", unknown: "Dokument",
    number: "Broj", date: "Datum", supplier: "Izdavatelj", customer: "Primatelj", payable: "Za plaćanje",
    profiles: "Pravila", terms: "Pojmovi", where: "Mjesto", noFindings: "Nema nalaza.",
    errors: ["greška", "greške", "grešaka"], warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    sources: "Pravila: CEN/TC 434 (EUPL 1.2) i Porezna uprava RH.",
  },
  bs: {
    lang: "Jezik", title: "Provjera e-fakture",
    lead: "EN 16931 (UBL i CII) i hrvatski CIUS za Fiskalizaciju 2.0. Provjera se izvodi u vašem pregledniku: faktura se nikamo ne šalje.",
    pasteLabel: "Zalijepite XML fakture", validate: "Provjeri", chooseFile: "ili odaberite datoteku",
    privacy: "Sadržaj fakture obrađuje se samo u ovom pregledniku i ne šalje se na server. Nema kolačića.",
    license: "licenca", loading: "Učitavam pravila…", running: "Provjeravam…",
    empty: "Zalijepite XML ili odaberite datoteku.",
    tooBig: (mb) => `Datoteka je veća od ${mb} MB.`,
    encoding: (e) => `Kodiranje "${e}" nije podržano. Sačuvajte datoteku kao UTF-8.`,
    badBytes: (e) => `Datoteka nije ispravno kodirana kao ${e}.`,
    valid: "Faktura je ispravna", invalid: "Faktura nije ispravna",
    fatal: "Greška", warning: "Upozorenje", info: "Napomena",
    invoice: "Faktura", creditNote: "Odobrenje", unknown: "Dokument",
    number: "Broj", date: "Datum", supplier: "Izdavalac", customer: "Primalac", payable: "Za plaćanje",
    profiles: "Pravila", terms: "Termini", where: "Mjesto", noFindings: "Nema nalaza.",
    errors: ["greška", "greške", "grešaka"], warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    sources: "Pravila: CEN/TC 434 (EUPL 1.2) i Porezna uprava RH.",
  },
  sr: {
    lang: "Jezik", title: "Provera e-fakture",
    lead: "EN 16931 (UBL i CII) i hrvatski CIUS za Fiskalizaciju 2.0. Provera se izvodi u vašem pregledaču: faktura se nikuda ne šalje.",
    pasteLabel: "Nalepite XML fakture", validate: "Proveri", chooseFile: "ili izaberite datoteku",
    privacy: "Sadržaj fakture obrađuje se samo u ovom pregledaču i ne šalje se na server. Nema kolačića.",
    license: "licenca", loading: "Učitavam pravila…", running: "Proveravam…",
    empty: "Nalepite XML ili izaberite datoteku.",
    tooBig: (mb) => `Datoteka je veća od ${mb} MB.`,
    encoding: (e) => `Kodiranje "${e}" nije podržano. Sačuvajte datoteku kao UTF-8.`,
    badBytes: (e) => `Datoteka nije ispravno kodirana kao ${e}.`,
    valid: "Faktura je ispravna", invalid: "Faktura nije ispravna",
    fatal: "Greška", warning: "Upozorenje", info: "Napomena",
    invoice: "Faktura", creditNote: "Odobrenje", unknown: "Dokument",
    number: "Broj", date: "Datum", supplier: "Izdavalac", customer: "Primalac", payable: "Za plaćanje",
    profiles: "Pravila", terms: "Termini", where: "Mesto", noFindings: "Nema nalaza.",
    errors: ["greška", "greške", "grešaka"], warnings: ["upozorenje", "upozorenja", "upozorenja"],
    rules: ["pravilo", "pravila", "pravila"],
    sources: "Pravila: CEN/TC 434 (EUPL 1.2) i Poreska uprava Republike Hrvatske.",
  },
  en: {
    lang: "Language", title: "E-invoice check",
    lead: "EN 16931 (UBL and CII) and the Croatian CIUS for Fiskalizacija 2.0. The check runs in your browser: the invoice is never sent anywhere.",
    pasteLabel: "Paste the invoice XML", validate: "Check", chooseFile: "or choose a file",
    privacy: "The invoice content is processed only in this browser and is never uploaded. No cookies.",
    license: "licence", loading: "Loading rules…", running: "Checking…",
    empty: "Paste XML or choose a file.",
    tooBig: (mb) => `The file is larger than ${mb} MB.`,
    encoding: (e) => `Encoding "${e}" is not supported. Save the file as UTF-8.`,
    badBytes: (e) => `The file is not valid ${e}.`,
    valid: "The invoice is valid", invalid: "The invoice is not valid",
    fatal: "Error", warning: "Warning", info: "Note",
    invoice: "Invoice", creditNote: "Credit note", unknown: "Document",
    number: "Number", date: "Date", supplier: "Seller", customer: "Buyer", payable: "Amount due",
    profiles: "Rules", terms: "Terms", where: "Location", noFindings: "No findings.",
    errors: ["error", "errors", "errors"], warnings: ["warning", "warnings", "warnings"],
    rules: ["rule", "rules", "rules"],
    sources: "Rules: CEN/TC 434 (EUPL 1.2) and the Croatian Tax Administration.",
  },
};

/** 1 greška, 2 greške, 5 grešaka, 21 greška; engleski samo jednina/množina. */
function plural(lang, n, [one, few, many]) {
  if (lang === "en") return n === 1 ? one : few;
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return one;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

let lang = initialLang();
let lastReport = null;

function initialLang() {
  try {
    const saved = localStorage.getItem("vf-lang");
    if (LANGS.includes(saved)) return saved;
  } catch { /* privatni prozor */ }
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  return LANGS.includes(nav) ? nav : nav === "sh" ? "hr" : "en";
}

function applyLang() {
  const L = T[lang];
  document.documentElement.lang = lang;
  $("lang").value = lang;
  for (const n of document.querySelectorAll("[data-t]")) n.textContent = L[n.dataset.t];
  document.title = `verifaktura · ${L.title}`;
  renderSources();
}

// --- runtime za preglednik -------------------------------------------------

const sefCache = new Map();
let artefacts = { version: "unknown", source: "CEN/TC 434" };
let engineVersion = "unknown";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Parser preglednika ne učitava vanjske DTD-ove ni entitete. */
function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const err = doc.getElementsByTagName("parsererror")[0];
  if (err) throw new Error(err.textContent.trim().split("\n")[0]);
  if (!doc.documentElement) throw new Error("dokument nema korijenski element");
  return doc;
}

const runtime = {
  get engineVersion() { return engineVersion; },
  get artefacts() { return artefacts; },
  baseSef: { ubl: "sef/en16931-ubl.sef.json", cii: "sef/en16931-cii.sef.json" },
  async loadSef(url) {
    if (!sefCache.has(url)) {
      const pending = fetchJson(url);
      sefCache.set(url, pending);
      pending.catch(() => sefCache.delete(url));
    }
    return sefCache.get(url);
  },
  async transform(sef, xml) {
    const r = await globalThis.SaxonJS.transform(
      { stylesheetInternal: sef, sourceText: xml, destination: "serialized" },
      "async",
    );
    return r.principalResult;
  },
  parseXml,
};

registerProfile({ ...hrProfileBase, sefPath: "sef/hr-cius-ext-ubl.sef.json" });

const meta = Promise.all([
  fetchJson("sef/artefacts.json").then((a) => {
    if (a.en16931?.version) {
      artefacts = { version: a.en16931.version, source: a.en16931.source ?? "CEN/TC 434" };
    }
  }),
  fetchJson("build.json").then((b) => { engineVersion = b.engineVersion; }),
]).finally(renderSources);

function renderSources() {
  $("sources").textContent = `${T[lang].sources} EN 16931 ${artefacts.version}, HR ${hrProfileBase.version}.`;
}

// --- ulaz -------------------------------------------------------------------

class InputError extends Error {}

/**
 * Dekodira datoteku po kodiranju iz XML deklaracije. TextDecoder s `fatal`
 * odbija nepoznata kodiranja i neispravne bajtove umjesto da proizvede
 * mojibake, koji bi pao na naizgled nepovezanim pravilima.
 */
function decodeFile(buf) {
  const bytes = new Uint8Array(buf);
  let label = "utf-8";
  if (bytes[0] === 0xfe && bytes[1] === 0xff) label = "utf-16be";
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) label = "utf-16le";
  else {
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200));
    const declared = /<\?xml[^>]*\bencoding\s*=\s*["']([A-Za-z0-9._-]{1,40})["']/i.exec(head)?.[1];
    if (declared) label = declared;
  }
  let decoder;
  try {
    decoder = new TextDecoder(label, { fatal: true });
  } catch {
    throw new InputError(T[lang].encoding(label));
  }
  try {
    return decoder.decode(bytes);
  } catch {
    throw new InputError(T[lang].badBytes(label));
  }
}

async function readInput() {
  const file = $("file").files[0];
  if (file) {
    if (file.size > MAX_BYTES) throw new InputError(T[lang].tooBig(MAX_BYTES / 1048576));
    return decodeFile(await file.arrayBuffer());
  }
  const text = $("xml").value;
  if (new Blob([text]).size > MAX_BYTES) throw new InputError(T[lang].tooBig(MAX_BYTES / 1048576));
  return text;
}

// --- izvještaj ----------------------------------------------------------------

function render(report) {
  const L = T[lang];
  const d = report.document;
  const s = report.summary;

  const verdict = $("verdict");
  verdict.replaceChildren();
  verdict.className = `verdict ${report.valid ? "ok" : "bad"}`;
  verdict.append(el("strong", "", report.valid ? L.valid : L.invalid));
  verdict.append(el("span", "counts",
    `${s.fatal} ${plural(lang, s.fatal, L.errors)} · ${s.warning} ${plural(lang, s.warning, L.warnings)} · ` +
    `${s.rulesFired} ${plural(lang, s.rulesFired, L.rules)} · ${s.durationMs} ms`));

  const dl = $("doc");
  dl.replaceChildren();
  const row = (k, v) => {
    if (!v) return;
    dl.append(el("dt", "", k), el("dd", "", v));
  };
  row(L[d.type] ?? L.unknown, d.syntax.toUpperCase());
  row(L.number, d.id);
  row(L.date, d.issueDate);
  row(L.supplier, d.supplier?.name);
  row(L.customer, d.customer?.name);
  row(L.payable, d.payableAmount && `${d.payableAmount} ${d.currency ?? ""}`.trim());
  row(L.profiles, report.profiles.map((p) => `${p.id} ${p.version}`).join(", "));

  const list = $("issues");
  list.replaceChildren();
  if (report.issues.length === 0) list.append(el("li", "none", L.noFindings));
  const order = { fatal: 0, warning: 1, info: 2 };
  for (const i of [...report.issues].sort((a, b) => order[a.severity] - order[b.severity])) {
    const li = el("li", `issue ${i.severity}`);
    const head = el("div", "head");
    head.append(el("span", "sev", L[i.severity]), el("code", "rule", i.ruleId));
    li.append(head, el("p", "msg", i.message));
    if (i.hint) li.append(el("p", "hint", i.hint));
    const facts = el("dl", "facts");
    if (i.businessTerms.length) facts.append(el("dt", "", L.terms), el("dd", "", i.businessTerms.join(", ")));
    if (i.location.xpath) facts.append(el("dt", "", L.where), el("dd", "xpath", i.location.xpath));
    if (facts.childElementCount) li.append(facts);
    list.append(li);
  }
  $("result").hidden = false;
}

function setStatus(text, isError = false) {
  const n = $("status");
  n.textContent = text;
  n.classList.toggle("error", isError);
}

let lastInput = null;

async function check(event) {
  event?.preventDefault();
  const button = $("run");
  button.disabled = true;
  try {
    const xml = await readInput();
    if (!xml.trim()) {
      setStatus(T[lang].empty, true);
      return;
    }
    lastInput = xml;
    setStatus(sefCache.size ? T[lang].running : T[lang].loading);
    await meta;
    lastReport = await runValidation(xml, { lang }, runtime);
    render(lastReport);
    setStatus("");
  } catch (e) {
    $("result").hidden = true;
    setStatus(e instanceof Error ? e.message : String(e), true);
  } finally {
    button.disabled = false;
  }
}

$("form").addEventListener("submit", check);
$("file").addEventListener("change", () => {
  if ($("file").files[0]) {
    $("xml").value = "";
    check();
  }
});
$("xml").addEventListener("input", () => { $("file").value = ""; });
$("lang").addEventListener("change", async () => {
  lang = $("lang").value;
  try { localStorage.setItem("vf-lang", lang); } catch { /* privatni prozor */ }
  applyLang();
  // Poruke pravila su u izvještaju već razriješene na jezik, pa se ponovi provjera.
  if (lastReport && lastInput) {
    lastReport = await runValidation(lastInput, { lang }, runtime);
    render(lastReport);
  }
});

for (const type of ["dragover", "drop"]) {
  document.addEventListener(type, (e) => {
    e.preventDefault();
    if (type === "drop" && e.dataTransfer?.files[0]) {
      $("file").files = e.dataTransfer.files;
      $("xml").value = "";
      check();
    }
  });
}

applyLang();
