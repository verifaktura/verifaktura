#!/usr/bin/env node
/**
 * Provjera na najnižoj Node verziji koju paketi tvrde da podržavaju.
 *
 * Glavna testna matrica vrti razvojni alat (vitest/rolldown), koji traži noviji
 * Node od objavljenih paketa. Ta razlika znači da se `engines` tvrdnja nikad ne
 * bi provjerila — dok je korisnik na starijoj verziji ne pogodi.
 *
 * Ovdje se pokreće samo izgrađeni kod: učitavanje jezgra (što izvršava
 * `import ... with { type: "json" }`, pravi razlog za donju granicu) i gradnja
 * fakture, koja ne treba validacione artefakte.
 */
import assert from "node:assert/strict";

const core = await import("verifaktura");
assert.equal(typeof core.validate, "function", "verifaktura nema validate()");
assert.ok(core.catalogStats().businessRules > 200, "katalog pravila nije učitan");

const { buildUbl, simpleInvoice, isValidOib } = await import("@verifaktura/build");

const xml = buildUbl(
  simpleInvoice({
    id: "SMOKE-1",
    issueDate: "2026-07-29",
    currency: "EUR",
    vatRate: "25",
    seller: {
      name: "Prodavatelj d.o.o.",
      vatId: "HR12345678903",
      address: { street: "Ulica 1", city: "Zagreb", postalCode: "10000", country: "HR" },
    },
    buyer: {
      name: "Kupac d.o.o.",
      address: { street: "Ulica 2", city: "Split", postalCode: "21000", country: "HR" },
    },
    lines: [{ name: "Usluga", quantity: 1, unitPrice: "100.00" }],
  }),
);

assert.match(xml, /<cbc:ID>SMOKE-1<\/cbc:ID>/, "builder nije upisao broj računa");
assert.match(xml, /<cbc:PayableAmount currencyID="EUR">125\.00<\/cbc:PayableAmount>/, "PDV nije izračunat");
assert.equal(isValidOib("12345678903"), true, "OIB provjera ne radi");

console.log(`ok  Node ${process.version}: paketi se učitavaju, builder računa ispravno`);
