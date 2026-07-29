# verifaktura

Validate and generate **EN 16931** e-invoices — UBL 2.1 and CII D16B — with
national CIUS profiles and rule messages in Croatian, Bosnian and Serbian.

*Hrvatska verzija: [README.hr.md](./README.hr.md)*

```bash
npm install verifaktura @verifaktura/build
```

```ts
import { buildUbl, simpleInvoice } from "@verifaktura/build";
import { validate } from "verifaktura";

const xml = buildUbl(simpleInvoice({
  id: "2026-001", issueDate: "2026-07-29", currency: "EUR", vatRate: "25",
  seller, buyer,
  lines: [{ name: "Software development", quantity: 10, unitPrice: "80.00" }],
}));

const report = await validate(xml, { lang: "hr" });
// report.valid === true
```

When something is wrong, the report says what and where — in the user's language:

```
FATAL  BR-02   Račun mora sadržavati broj računa (BT-1).   terms: BT-1
```

## Packages

| Package | What it does |
|---|---|
| [`verifaktura`](./packages/core) | validation engine |
| [`@verifaktura/build`](./packages/build) | builds valid EN 16931 invoices |
| [`@verifaktura/cius-hr`](./packages/cius-hr) | Croatian profile (Fiskalizacija 2.0) |
| [`@verifaktura/cli`](./packages/cli) | command line interface |

Planned: `@verifaktura/cius-rs` (Serbia, SEF), `@verifaktura/cius-ba`
(Bosnia and Herzegovina, pending implementing regulations).

## Why

Validation rules change mid-mandate. The Croatian Tax Administration shipped a
revised validator in March 2026, effective the 15th. Anyone who copied the rules
into their own code went stale that day — and finds out when an invoice gets
rejected.

verifaktura does not copy rules. It pulls the official artefacts (CEN/TC 434,
Croatian Tax Administration) at build time, and CI warns when a new release
appears.

Schematron runs through Saxon-JS as a precompiled SEF — no JVM, ~250 ms per
document.

## Status

| | |
|---|---|
| EN 16931, UBL | validation and generation |
| EN 16931, CII | validation; document summary is UBL-only for now |
| Localisation (hr/bs/sr) | 223/223 business rules (BR-*) |
| Croatian CIUS | working, including national extensions |

Known gaps: `location.line` and `column` are not populated (XPath only),
CII generation is not implemented.

## Development

```bash
npm install
npm run prepare:sef   # downloads and compiles validation artefacts, ~2 min
npm test
npm run build

node scripts/e2e.mjs        # validate reference invoices
node scripts/roundtrip.mjs  # build -> validate
```

`prepare:sef` needs network access. Skip the Croatian profile with
`SKIP_HR=1 npm run prepare:sef`.

Report format: [FORMAT.md](./FORMAT.md) ·
contributing: [CONTRIBUTING.md](./CONTRIBUTING.md) ·
releasing: [RELEASING.md](./RELEASING.md)

## Licence

The code is [Apache-2.0](./LICENSE).

Validation artefacts are not part of this repository — they are downloaded at
build time and, in the published npm packages, keep the licence of their source.
Attribution: [NOTICE](./NOTICE).
