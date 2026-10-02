#!/usr/bin/env node
/**
 * Provjerava jesu li izašla nova pravila: CEN release, sadržaj validatora i
 * specifikacije Porezne uprave, novi dokumenti na stranici o eRačunu.
 * Uspoređuje sa scripts/watch-rules.json; razlike piše na stdout (Markdown)
 * i izlazi s kodom 2. Greška dohvata je kod 1, da se ne zamijeni s "nema promjena".
 *
 *   node scripts/watch-rules.mjs            # provjera
 *   node scripts/watch-rules.mjs --update   # zapiši trenutno stanje kao poznato
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STATE = join(dirname(fileURLToPath(import.meta.url)), "watch-rules.json");
const CEN_REPO = "https://github.com/ConnectingEurope/eInvoicing-EN16931.git";
const PU_PAGE = "https://porezna.gov.hr/fiskalizacija/bezgotovinski-racuni/eracun";
const PU_DOC = (id) => `https://porezna.gov.hr/fiskalizacija/api/dokumenti/${id}`;
// Dokumenti čiji se sadržaj prati: validator (Schematron) i specifikacija CIUS-a.
const PU_WATCHED = ["196", "197"];

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "verifaktura-watch (+https://verifaktura.com)" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

function latestCenTag() {
  const out = execFileSync("git", ["ls-remote", "--tags", "--refs", CEN_REPO], { encoding: "utf-8" });
  const tags = out.split("\n").map((l) => l.split("refs/tags/")[1]).filter((t) => /^validation-[\d.]+$/.test(t ?? ""));
  if (tags.length === 0) throw new Error(`${CEN_REPO}: nema validation-* tagova`);
  return tags.sort((a, b) => a.localeCompare(b, "en", { numeric: true })).at(-1);
}

async function puDocuments() {
  const page = await (await get(PU_PAGE)).text();
  const docs = {};
  for (const [, id, title] of page.matchAll(/dokumenti\/(\d+)"[^>]*>(?:(?!dokumenti\/).)*?<h5 class="title">([^<]+)<\/h5>/gs)) {
    docs[id] = title.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  }
  if (Object.keys(docs).length === 0) throw new Error(`${PU_PAGE}: nije pronađen nijedan dokument (promijenjen izgled stranice?)`);
  return docs;
}

async function sha256(url) {
  const buf = Buffer.from(await (await get(url)).arrayBuffer());
  return createHash("sha256").update(buf).digest("hex");
}

async function current() {
  const documents = await puDocuments();
  const hashes = {};
  for (const id of PU_WATCHED) hashes[id] = await sha256(PU_DOC(id));
  return { cen: latestCenTag(), documents, hashes };
}

function diff(known, now) {
  const lines = [];
  if (now.cen !== known.cen) lines.push(`- **CEN:** novi release \`${now.cen}\` (poznat \`${known.cen}\`). ${CEN_REPO.replace(/\.git$/, "")}/releases`);
  for (const id of PU_WATCHED) {
    if (now.hashes[id] !== known.hashes[id]) {
      lines.push(`- **Porezna, dokument ${id}** (${now.documents[id] ?? "?"}): sadržaj promijenjen. ${PU_DOC(id)}`);
    }
  }
  for (const [id, title] of Object.entries(now.documents)) {
    if (!(id in known.documents)) lines.push(`- **Porezna, novi dokument ${id}:** ${title}. ${PU_DOC(id)}`);
    else if (known.documents[id] !== title) lines.push(`- **Porezna, dokument ${id} preimenovan:** "${known.documents[id]}" → "${title}".`);
  }
  for (const id of Object.keys(known.documents)) {
    if (!(id in now.documents)) lines.push(`- **Porezna, dokument ${id} uklonjen sa stranice:** ${known.documents[id]}.`);
  }
  return lines;
}

try {
  const now = await current();
  if (process.argv.includes("--update")) {
    writeFileSync(STATE, JSON.stringify(now, null, 2) + "\n");
    console.log(`Zapisano: ${STATE}`);
    process.exit(0);
  }
  const lines = diff(JSON.parse(readFileSync(STATE, "utf-8")), now);
  if (lines.length === 0) {
    console.log("Nema novih pravila.");
    process.exit(0);
  }
  console.log(lines.join("\n"));
  console.log("\nAžuriraj pravila (scripts/build-sef.mjs), pokreni testove, objavi release i javi prijavljenima. Zatim `node scripts/watch-rules.mjs --update`.");
  process.exit(2);
} catch (e) {
  console.error(`Provjera pravila nije uspjela: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
