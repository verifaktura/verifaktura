import { describe, it, expect } from "vitest";
import { buildUbl, simpleInvoice, computeVatBreakdown, computeTotals } from "../src/index.js";
import type { Invoice, Party } from "../src/model.js";

const seller: Party = {
  name: "Primjer Telekom d.o.o.",
  vatId: "BA210300400000",
  legalId: "4210300400000",
  address: { street: "Primjerska bb", city: "Gracanica", postalCode: "75320", country: "BA" },
};

const buyer: Party = {
  name: "Primjer Obrt vl. Ime Prezime",
  legalId: "4329167750000",
  address: { street: "Primjerska 56", city: "Mostar", postalCode: "88000", country: "BA" },
};

describe("simpleInvoice", () => {
  const invoice = simpleInvoice({
    id: "2026-001",
    issueDate: "2026-07-29",
    dueDate: "2026-08-28",
    currency: "BAM",
    seller,
    buyer,
    vatRate: "17",
    iban: "BA391941051193401279",
    lines: [{ name: "Najam aplikacije - PLUS", quantity: 1, unitPrice: "8.00" }],
  });

  it("preslikava se u puni model, ne u zaseban put", () => {
    expect(invoice.lines[0].vatCategory).toBe("S");
    expect(invoice.lines[0].vatRate).toBe("17");
    expect(invoice.paymentMeans?.code).toBe("30");
  });

  it("računa PDV i ukupne iznose tačno", () => {
    const breakdown = computeVatBreakdown(invoice);
    const totals = computeTotals(invoice, breakdown);
    expect(breakdown).toEqual([
      { category: "S", rate: "17.00", taxableAmount: "8.00", taxAmount: "1.36" },
    ]);
    expect(totals.netTotal).toBe("8.00");
    expect(totals.vatTotal).toBe("1.36");
    expect(totals.payableAmount).toBe("9.36");
  });

  it("proizvodi UBL s ključnim elementima", () => {
    const xml = buildUbl(invoice);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>");
    expect(xml).toContain("<cbc:ID>2026-001</cbc:ID>");
    expect(xml).toContain('<cbc:PayableAmount currencyID="BAM">9.36</cbc:PayableAmount>');
    expect(xml).toContain("<cbc:CompanyID>BA210300400000</cbc:CompanyID>");
  });
});

describe("složeni slučajevi", () => {
  const base: Invoice = {
    id: "2026-002",
    issueDate: "2026-07-29",
    currency: "EUR",
    seller,
    buyer,
    lines: [
      { name: "Usluga A", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
      { name: "Usluga B", quantity: "2", unitPrice: "50.00", vatCategory: "S", vatRate: "13" },
      { name: "Usluga C", quantity: "1", unitPrice: "40.00", vatCategory: "AE", vatRate: "0" },
    ],
  };

  it("grupiše rekapitulaciju po kategoriji i stopi", () => {
    const b = computeVatBreakdown(base);
    expect(b).toHaveLength(3);
    expect(b.find((e) => e.rate === "25.00")).toMatchObject({ taxableAmount: "100.00", taxAmount: "25.00" });
    expect(b.find((e) => e.rate === "13.00")).toMatchObject({ taxableAmount: "100.00", taxAmount: "13.00" });
  });

  it("postavlja PDV na nulu za prijenos porezne obaveze (BR-AE-09)", () => {
    const ae = computeVatBreakdown(base).find((e) => e.category === "AE");
    expect(ae?.taxAmount).toBe("0.00");
  });

  it("uračunava popuste i troškove na razini dokumenta (BR-CO-13)", () => {
    const inv: Invoice = {
      ...base,
      allowances: [{ amount: "10.00", reason: "Rabat", vatCategory: "S", vatRate: "25" }],
      charges: [{ amount: "5.00", reason: "Dostava", vatCategory: "S", vatRate: "25" }],
    };
    const b = computeVatBreakdown(inv);
    const t = computeTotals(inv, b);
    expect(t.lineNetTotal).toBe("240.00");
    expect(t.allowanceTotal).toBe("10.00");
    expect(t.chargeTotal).toBe("5.00");
    expect(t.netTotal).toBe("235.00"); // 240 - 10 + 5
    // osnovica za 25% : 100 (stavka) - 10 (popust) + 5 (trošak) = 95
    expect(b.find((e) => e.rate === "25.00")?.taxableAmount).toBe("95.00");
  });

  it("uračunava popuste na stavci u neto iznos (BT-131)", () => {
    const inv: Invoice = {
      ...base,
      lines: [
        {
          name: "Usluga s popustom",
          quantity: "10",
          unitPrice: "10.00",
          vatCategory: "S",
          vatRate: "25",
          allowances: [{ amount: "15.00", reason: "Kolicinski rabat" }],
        },
      ],
    };
    const t = computeTotals(inv, computeVatBreakdown(inv));
    expect(t.lineNetTotal).toBe("85.00"); // 100 - 15
  });

  it("gradi odobrenje (CreditNote) kad je typeCode 381", () => {
    const xml = buildUbl({ ...base, typeCode: "381" });
    expect(xml).toContain("<CreditNote");
    expect(xml).toContain("cac:CreditNoteLine");
    expect(xml).toContain("cbc:CreditedQuantity");
    expect(xml).not.toContain("cac:InvoiceLine");
  });

  it("escapea specijalne znakove u nazivima", () => {
    const xml = buildUbl({
      ...base,
      lines: [{ name: 'Usluga "A" & <B>', quantity: "1", unitPrice: "1.00", vatCategory: "S", vatRate: "25" }],
    });
    expect(xml).toContain("Usluga &quot;A&quot; &amp; &lt;B&gt;");
    expect(xml).not.toContain("<B>");
  });
});
