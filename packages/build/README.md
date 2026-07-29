# @verifaktura/build

Builds EN 16931 e-invoices (UBL 2.1) from a typed model. The output is run
through the `verifaktura` validator in CI — that is the difference between an
XML generator and a generator of *valid* XML.

```bash
npm install @verifaktura/build
```

## Two levels

**`simpleInvoice`** — the ordinary case: one VAT rate, no document-level
allowances.

```ts
import { buildUbl, simpleInvoice } from "@verifaktura/build";

const xml = buildUbl(simpleInvoice({
  id: "2026-001",
  issueDate: "2026-07-29",
  dueDate: "2026-08-28",
  currency: "EUR",
  vatRate: "25",
  iban: "HR1210010051863000160",
  seller: {
    name: "My Company Ltd",
    vatId: "HR12345678903",        // country prefix is required (BR-CO-09)
    address: { street: "Ilica 1", city: "Zagreb", postalCode: "10000", country: "HR" },
  },
  buyer: {
    name: "Customer Ltd",
    address: { street: "Riva 2", city: "Split", postalCode: "21000", country: "HR" },
  },
  lines: [{ name: "Software development", quantity: 10, unitPrice: "80.00" }],
}));
```

**The full `Invoice` model** — multiple VAT rates, document- and line-level
allowances and charges, credit notes, exemptions with a reason.
`simpleInvoice` is a thin layer over it, not a separate path: start simple and
grow into it without rewriting.

```ts
const xml = buildUbl({
  id: "2026-003", issueDate: "2026-07-29", currency: "EUR",
  seller, buyer,
  lines: [
    { name: "Service A", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
    { name: "Service B", quantity: "2", unitPrice: "50.00",  vatCategory: "S", vatRate: "13" },
  ],
  allowances: [{ amount: "10.00", reason: "Discount", vatCategory: "S", vatRate: "25" }],
  charges:    [{ amount: "5.00",  reason: "Shipping", vatCategory: "S", vatRate: "25" }],
});
```

## What is computed for you

Omit `vatBreakdown` and `totals` and they are derived from the lines:

- VAT breakdown grouped by category and rate (BG-23)
- taxable base per group = Σ lines + Σ charges − Σ allowances (BR-S-08 and friends)
- tax amount = base × rate / 100, half-up to 2 decimals (BR-CO-17)
- VAT of 0 for the AE, K, G and O categories (BR-AE-09 and friends)
- all document totals (BR-CO-10 through BR-CO-16)

You can also supply them explicitly — useful when mirroring an existing document
and you want to keep the original even where it disagrees with the arithmetic.

## Money

Everything is held as `bigint` in minor units; `number` is never used. Floating
point would mean `0.1 + 0.2 !== 0.3` failing a document on BR-CO-15 or
BR-CO-17 — a bug that shows up at a customer, on the thirtieth invoice, not in
your tests.

Amounts are strings (`"1234.56"`); a comma is accepted too (`"1234,56"`).

## The model follows BT/BG

Every field is documented with its EN 16931 business term. When the validator
reports `BT-31`, you know it means `seller.vatId` — no digging through the
specification.

## Croatian invoices

`isValidOib` checks the OIB checksum (ISO 7064 MOD 11,10) before you build.
For the Croatian profile fields — issue time, operator, KPD classification —
see [`@verifaktura/cius-hr`](https://www.npmjs.com/package/@verifaktura/cius-hr).

## Licence

Apache-2.0
