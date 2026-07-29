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
    name: "prijenos porezne obaveze (AE) s razlogom oslobodjenja",
    invoice: {
      id: "2026-004", issueDate: "2026-07-29", currency: "EUR",
      seller: eurSeller, buyer: eurBuyer,
      paymentMeans: { code: "30", accountId: "HR1210010051863000160" },
      lines: [{ name: "Usluga u prijenosu", quantity: "1", unitPrice: "1000.00", vatCategory: "AE", vatRate: "0" }],
      vatBreakdown: [{
        category: "AE", rate: "0", taxableAmount: "1000.00", taxAmount: "0.00",
        exemptionReason: "Prijenos porezne obveze",
        exemptionReasonCode: "VATEX-EU-AE",
      }],
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
