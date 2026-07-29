#!/usr/bin/env node
/**
 * Round-trip provjera: @verifaktura/build gradi dokument, verifaktura ga validira.
 *
 * Ovo je centralna tvrdnja proizvoda — "izlaz je garantovano validan". Bez ovog
 * testa builder je samo generator XML-a, a takvih ima svugdje.
 *
 * Traži: npm run prepare:sef && npm run build
 */
import { existsSync } from "node:fs";
import { buildUbl, simpleInvoice } from "@verifaktura/build";
import { validate } from "verifaktura";
import { HR_CUSTOMIZATION_ID } from "@verifaktura/cius-hr";
import { runCases, formatIssues } from "./lib/cases.mjs";
import { baSeller, baBuyer, hrSeller, hrBuyer, HR_IBAN, BA_IBAN } from "./lib/parties.mjs";

/** @type {{name: string, invoice: import("@verifaktura/build").Invoice}[]} */
const CASES = [
  {
    name: "jednostavna BAM faktura, PDV 17%",
    invoice: simpleInvoice({
      id: "2026-001",
      issueDate: "2026-07-29",
      dueDate: "2026-08-28",
      currency: "BAM",
      seller: baSeller,
      buyer: baBuyer,
      vatRate: "17",
      iban: BA_IBAN,
      lines: [{ name: "Najam aplikacije - PLUS", quantity: 1, unitPrice: "8.00" }],
    }),
  },
  {
    name: "vise stavki i decimalne kolicine",
    invoice: simpleInvoice({
      id: "2026-002",
      issueDate: "2026-07-29",
      currency: "BAM",
      seller: baSeller,
      buyer: baBuyer,
      vatRate: "17",
      iban: BA_IBAN,
      lines: [
        { name: "Konsalting", quantity: "7.5", unitPrice: "120.00", unitCode: "HUR" },
        { name: "Licenca", quantity: 3, unitPrice: "49.99" },
        { name: "Podrska", quantity: 1, unitPrice: "0.01" },
      ],
    }),
  },
  {
    name: "dvije PDV stope + popust i trosak na dokumentu",
    invoice: {
      id: "2026-003",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        { name: "Usluga A", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
        { name: "Usluga B", quantity: "2", unitPrice: "50.00", vatCategory: "S", vatRate: "13" },
      ],
      allowances: [{ amount: "10.00", reason: "Rabat", vatCategory: "S", vatRate: "25" }],
      charges: [{ amount: "5.00", reason: "Dostava", vatCategory: "S", vatRate: "25" }],
    },
  },
  {
    // NAMJERNO bez ručnog vatBreakdown-a: raniji test ga je navodio, pa je
    // zaobilazio automatski put koji svi stvarno koriste — i propustio da taj
    // put nikad nije popunjavao razlog oslobođenja (BR-AE-10).
    name: "prijenos porezne obaveze (AE), automatski breakdown",
    invoice: {
      id: "2026-004",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        {
          name: "Usluga u prijenosu",
          quantity: "1",
          unitPrice: "1000.00",
          vatCategory: "AE",
          vatRate: "0",
          vatExemptionReason: "Prijenos porezne obveze",
          vatExemptionReasonCode: "VATEX-EU-AE",
        },
      ],
    },
  },
  {
    name: "oslobodjeno PDV-a (E), automatski breakdown",
    invoice: {
      id: "2026-006",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        {
          name: "Oslobodjena usluga",
          quantity: "1",
          unitPrice: "500.00",
          vatCategory: "E",
          vatRate: "0",
          vatExemptionReason: "Oslobodjeno prema clanu 39.",
        },
      ],
    },
  },
  {
    // Kategorija "O" zabranjuje porezni identifikator prodavatelja (BR-O-02),
    // suprotno od svih ostalih kategorija, i ne smije nositi stopu (BR-O-05).
    name: "nije predmet oporezivanja (O), bez stope i bez PDV ID-a",
    invoice: {
      id: "2026-007",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: { ...hrSeller, vatId: undefined },
      buyer: { ...hrBuyer, vatId: undefined },
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        {
          name: "Izvan podrucja PDV-a",
          quantity: "1",
          unitPrice: "250.00",
          vatCategory: "O",
          vatExemptionReason: "Nije predmet oporezivanja PDV-om",
        },
      ],
    },
  },
  {
    // UBL 2.1 CreditNote nema cbc:DueDate — BT-9 mora ići u PaymentMeans.
    name: "odobrenje (CreditNote) s datumom dospijeca",
    invoice: {
      id: "2026-008",
      issueDate: "2026-07-29",
      dueDate: "2026-08-28",
      typeCode: "381",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        { name: "Odobrenje", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
      ],
    },
  },
  {
    // BT-107/BT-108 se moraju navesti i kad se ponište u nulu, jer BR-CO-11 i
    // BR-CO-12 uspoređuju zbroj s prisutnim elementima.
    name: "popusti koji se ponistavaju u nulu",
    invoice: {
      id: "2026-009",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        { name: "Usluga", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
      ],
      allowances: [
        { amount: "10.00", reason: "Rabat", vatCategory: "S", vatRate: "25" },
        { amount: "-10.00", reason: "Ispravak rabata", vatCategory: "S", vatRate: "25" },
      ],
    },
  },
  {
    name: "sitne kolicine i zarez kao separator",
    invoice: {
      id: "2026-010",
      issueDate: "2026-07-29",
      currency: "EUR",
      seller: hrSeller,
      buyer: hrBuyer,
      paymentMeans: { code: "30", accountId: HR_IBAN },
      lines: [
        {
          name: "Materijal po gramu",
          quantity: "0,001",
          unitPrice: "1000,00",
          vatCategory: "S",
          vatRate: "25",
        },
        {
          name: "Sati",
          quantity: "2.345",
          unitPrice: "100.00",
          vatCategory: "S",
          vatRate: "25",
          unitCode: "HUR",
        },
      ],
    },
  },
  {
    name: "popust na stavci",
    invoice: {
      id: "2026-005",
      issueDate: "2026-07-29",
      currency: "BAM",
      seller: baSeller,
      buyer: baBuyer,
      paymentMeans: { code: "30", accountId: BA_IBAN },
      lines: [
        {
          name: "Usluga s rabatom",
          quantity: "10",
          unitPrice: "10.00",
          vatCategory: "S",
          vatRate: "17",
          allowances: [{ amount: "15.00", reason: "Kolicinski rabat" }],
        },
      ],
    },
  },
];

// Hrvatski slučajevi se dodaju samo ako je profil stvarno pripremljen. Ranije se
// dodavao bezuvjetno iako je komentar tvrdio suprotno, pa bi pad preuzimanja s
// porezna.gov.hr završio kriptičnom Saxon greškom umjesto razumljivim skipom.
const hrReady = existsSync(
  new URL("../packages/cius-hr/sef/hr-cius-ext-ubl.sef.json", import.meta.url),
);
if (!hrReady) {
  console.warn("upozorenje: hrvatski profil nije pripremljen — preskačem njegove slučajeve\n");
}

if (hrReady) {
  CASES.push(
    {
      name: "hrvatski eRacun (Fiskalizacija 2.0)",
      invoice: {
        customizationId: HR_CUSTOMIZATION_ID,
        profileId: "P1", // HR-BR-34
        id: "2026-001",
        issueDate: "2026-07-29",
        issueTime: "10:15:00", // HR-BR-2
        dueDate: "2026-08-28", // HR-BR-4
        currency: "EUR",
        seller: hrSeller,
        buyer: hrBuyer,
        paymentMeans: { code: "30", accountId: HR_IBAN },
        lines: [
          {
            name: "Usluga razvoja softvera",
            quantity: "10",
            unitPrice: "80.00",
            vatCategory: "S",
            vatRate: "25",
            unitCode: "HUR",
            vatCategoryName: "HR:PDV25", // HR-BT-12
            classification: { value: "62.10.11", scheme: "CG" }, // HR-BR-25
          },
        ],
      },
    },
    {
      // HR-BR-16 traži HR oznaku kategorije za stavke u E ili O, HR-BR-36 razlog
      // oslobođenja na stavci, a HR-BR-26 cijelo HR proširenje (HR-BG-2). Bez
      // toga oslobođena isporuka nije bila sastavljiva — a to nije rubni slučaj.
      name: "hrvatski eRacun s oslobodjenom stavkom (E)",
      invoice: {
        customizationId: HR_CUSTOMIZATION_ID,
        profileId: "P1",
        id: "2026-011",
        issueDate: "2026-07-29",
        issueTime: "10:15:00",
        dueDate: "2026-08-28",
        currency: "EUR",
        seller: hrSeller,
        buyer: hrBuyer,
        paymentMeans: { code: "30", accountId: HR_IBAN },
        lines: [
          {
            name: "Oslobodjena usluga",
            quantity: "1",
            unitPrice: "500.00",
            vatCategory: "E",
            vatRate: "0",
            vatCategoryName: "HR:E",
            vatExemptionReason: "Oslobodjeno prema clanu 39.",
            classification: { value: "62.10.11", scheme: "CG" },
          },
        ],
      },
    },
  );
}

await runCases(
  "izgrađenih dokumenata je validno",
  CASES.map((c) => ({
    name: c.name,
    async run() {
      const r = await validate(buildUbl(c.invoice), { lang: "bs" });
      const clean = r.valid && r.summary.warning === 0;
      return clean
        ? { ok: true, note: `${r.summary.rulesFired} pravila, ${r.summary.durationMs} ms` }
        : { ok: false, detail: formatIssues(r.issues) };
    },
  })),
);
