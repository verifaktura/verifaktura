#!/usr/bin/env node
/**
 * Round-trip provjera: @verifaktura/build gradi dokument, verifaktura ga validira.
 *
 * Ovo je centralna tvrdnja proizvoda - "izlaz je garantovano validan". Bez ovog
 * testa builder je samo generator XML-a, a takvih ima svugdje.
 *
 * Traži: npm run prepare:sef && npm run build
 */
import { buildUbl, simpleInvoice } from "@verifaktura/build";
import { validate } from "verifaktura";
import { HR_CUSTOMIZATION_ID } from "@verifaktura/cius-hr";

const seller = {
  name: "Primjer Telekom d.o.o.",
  vatId: "BA210300400000",
  legalId: "4210300400000",
  electronicAddress: { value: "BA210300400000", scheme: "9930" },
  address: { street: "Primjerska bb", city: "Gracanica", postalCode: "75320", country: "BA" },
};

const buyer = {
  name: "Primjer Obrt vl. Ime Prezime",
  legalId: "4329167750000",
  electronicAddress: { value: "4329167750000", scheme: "9930" },
  address: { street: "Primjerska 56", city: "Mostar", postalCode: "88000", country: "BA" },
};

const eurSeller = { ...seller, vatId: "HR12345678901", address: { ...seller.address, country: "HR", city: "Zagreb", postalCode: "10000" } };
const eurBuyer = { ...buyer, vatId: "HR98765432109", address: { ...buyer.address, country: "HR", city: "Split", postalCode: "21000" } };

/** @type {{name: string, invoice: import("@verifaktura/build").Invoice}[]} */
const CASES = [
  {
    name: "jednostavna BAM faktura, PDV 17%",
    invoice: simpleInvoice({
      id: "2026-001", issueDate: "2026-07-29", dueDate: "2026-08-28",
      currency: "BAM", seller, buyer, vatRate: "17",
      iban: "BA391941051193401279",
      lines: [{ name: "Najam aplikacije - PLUS", quantity: 1, unitPrice: "8.00" }],
    }),
  },
  {
    name: "vise stavki i decimalne kolicine",
    invoice: simpleInvoice({
      id: "2026-002", issueDate: "2026-07-29",
      currency: "BAM", seller, buyer, vatRate: "17",
      iban: "BA391941051193401279",
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
      id: "2026-003", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [
        { name: "Usluga A", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
        { name: "Usluga B", quantity: "2", unitPrice: "50.00", vatCategory: "S", vatRate: "13" },
      ],
      allowances: [{ amount: "10.00", reason: "Rabat", vatCategory: "S", vatRate: "25" }],
      charges: [{ amount: "5.00", reason: "Dostava", vatCategory: "S", vatRate: "25" }],
    },
  },
  {
    // NAMJERNO bez rucnog vatBreakdown-a: raniji test ga je navodio, pa je
    // zaobilazio automatski put koji svi stvarno koriste - i propustio da taj
    // put nikad nije popunjavao razlog oslobodjenja (BR-AE-10).
    name: "prijenos porezne obaveze (AE), automatski breakdown",
    invoice: {
      id: "2026-004", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{
        name: "Usluga u prijenosu", quantity: "1", unitPrice: "1000.00",
        vatCategory: "AE", vatRate: "0",
        vatExemptionReason: "Prijenos porezne obveze",
        vatExemptionReasonCode: "VATEX-EU-AE",
      }],
    },
  },
  {
    name: "oslobodjeno PDV-a (E), automatski breakdown",
    invoice: {
      id: "2026-006", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{
        name: "Oslobodjena usluga", quantity: "1", unitPrice: "500.00",
        vatCategory: "E", vatRate: "0",
        vatExemptionReason: "Oslobodjeno prema clanu 39.",
      }],
    },
  },
  {
    // Kategorija "O" zabranjuje porezni identifikator prodavatelja (BR-O-02),
    // suprotno od svih ostalih kategorija.
    name: "nije predmet oporezivanja (O), bez stope i bez PDV ID-a",
    invoice: {
      id: "2026-007", issueDate: "2026-07-29", currency: "EUR",
      seller: { ...eurSeller, vatId: undefined },
      buyer: { ...eurBuyer, vatId: undefined },
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{
        name: "Izvan podrucja PDV-a", quantity: "1", unitPrice: "250.00",
        vatCategory: "O",
        vatExemptionReason: "Nije predmet oporezivanja PDV-om",
      }],
    },
  },
  {
    name: "odobrenje (CreditNote) s datumom dospijeca",
    invoice: {
      id: "2026-008", issueDate: "2026-07-29", dueDate: "2026-08-28",
      typeCode: "381", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{ name: "Odobrenje", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" }],
    },
  },
  {
    name: "popusti koji se ponistavaju u nulu",
    invoice: {
      id: "2026-009", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{ name: "Usluga", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" }],
      allowances: [
        { amount: "10.00", reason: "Rabat", vatCategory: "S", vatRate: "25" },
        { amount: "-10.00", reason: "Ispravak rabata", vatCategory: "S", vatRate: "25" },
      ],
    },
  },
  {
    name: "sitne kolicine i zarez kao separator",
    invoice: {
      id: "2026-010", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [
        { name: "Materijal po gramu", quantity: "0,001", unitPrice: "1000,00", vatCategory: "S", vatRate: "25" },
        { name: "Sati", quantity: "2.345", unitPrice: "100.00", vatCategory: "S", vatRate: "25", unitCode: "HUR" },
      ],
    },
  },
  {
    name: "popust na stavci",
    invoice: {
      id: "2026-005", issueDate: "2026-07-29", currency: "BAM",
      seller, buyer,
      paymentMeans: { code: "30", accountId: "BA391941051193401279" },
      lines: [{
        name: "Usluga s rabatom", quantity: "10", unitPrice: "10.00",
        vatCategory: "S", vatRate: "17",
        allowances: [{ amount: "15.00", reason: "Kolicinski rabat" }],
      }],
    },
  },
];

// Hrvatski eRačun se testira samo ako je profil pripremljen
// (npm run prepare:sef preuzima artefakte s porezna.gov.hr).
const hrSeller = {
  name: "Primjer d.o.o.", vatId: "HR12345678903", legalId: "12345678903",
  electronicAddress: { value: "12345678903", scheme: "9934" },
  address: { street: "Ilica 1", city: "Zagreb", postalCode: "10000", country: "HR" },
  contact: { name: "Operater 1", id: "12345678903" },   // HR-BT-4, HR-BT-5
};
const hrBuyer = {
  name: "Kupac d.o.o.", vatId: "HR98765432106", legalId: "98765432106",
  electronicAddress: { value: "98765432106", scheme: "9934" },
  address: { street: "Riva 2", city: "Split", postalCode: "21000", country: "HR" },
};

CASES.push({
  name: "hrvatski eRacun (Fiskalizacija 2.0)",
  invoice: {
    customizationId: HR_CUSTOMIZATION_ID,
    profileId: "P1",                       // HR-BR-34
    id: "2026-001",
    issueDate: "2026-07-29",
    issueTime: "10:15:00",                 // HR-BR-2
    dueDate: "2026-08-28",                 // HR-BR-4
    currency: "EUR",
    seller: hrSeller,
    buyer: hrBuyer,
    paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
    lines: [{
      name: "Usluga razvoja softvera", quantity: "10", unitPrice: "80.00",
      vatCategory: "S", vatRate: "25", unitCode: "HUR",
      classification: { value: "62.10.11", scheme: "CG" },   // HR-BR-25, KPD 2025
    }],
  },
});

let failed = 0;

for (const c of CASES) {
  const xml = buildUbl(c.invoice);
  const r = await validate(xml, { lang: "bs" });
  if (r.valid && r.summary.warning === 0) {
    console.log(`ok   ${c.name} (${r.summary.rulesFired} pravila, ${r.summary.durationMs} ms)`);
  } else {
    failed++;
    console.error(`FAIL ${c.name}`);
    for (const i of r.issues) {
      console.error(`     ${i.severity.toUpperCase()} ${i.ruleId}: ${i.message}`);
    }
  }
}

if (failed) {
  console.error(`\n${failed} od ${CASES.length} izgradjenih dokumenata nije validno.`);
  process.exit(1);
}
console.log(`\nSvih ${CASES.length} izgradjenih dokumenata je validno.`);
