# verifaktura

[![npm](https://img.shields.io/npm/v/verifaktura)](https://www.npmjs.com/package/verifaktura)
[![licence](https://img.shields.io/npm/l/verifaktura)](https://github.com/verifaktura/verifaktura/blob/main/LICENSE)

**EN 16931** e-invoice validation for UBL 2.1 and CII D16B, with national CIUS
profiles and rule messages in Croatian, Bosnian and Serbian.

Reference validators return `[BR-02]-An Invoice shall have an Invoice number
(BT-1).` and an XPath. This returns a structured finding with the rule id, the
business terms it concerns, a location and a message in the user's language —
the difference between "something is wrong" and "add the invoice number".

```bash
npm install verifaktura
```

```ts
import { validate } from "verifaktura";

const report = await validate(xml, { lang: "hr" });

if (!report.valid) {
  for (const issue of report.issues) {
    console.log(issue.ruleId, issue.businessTerms, issue.message);
    // BR-02  ["BT-1"]  Račun mora sadržavati broj računa (BT-1).
  }
}
```

Command line: [`@verifaktura/cli`](https://www.npmjs.com/package/@verifaktura/cli).

## Why not hard-coded rules

Validation rules change mid-mandate. The Croatian Tax Administration shipped a
revised validator in March 2026, effective the 15th. Anyone who copied the rules
into their own code went stale that day — and finds out when an invoice gets
rejected.

verifaktura does not copy rules. It pulls the official artefacts (CEN/TC 434,
Croatian Tax Administration) at build time, and CI warns when a new release
appears.

## National profiles

Profiles run **after** the base EN 16931 validation and are selected
automatically from `cbc:CustomizationID`:

```ts
import { validate } from "verifaktura";
import "@verifaktura/cius-hr";   // registers the Croatian profile

const report = await validate(xml, { lang: "hr" });
// report.profiles -> [{ id: "en16931", ... }, { id: "hr", ... }]
```

| Profile | Package | Status |
|---|---|---|
| EN 16931 (UBL + CII) | built in | ✅ |
| Croatia — Fiskalizacija 2.0 | `@verifaktura/cius-hr` | ✅ |
| Serbia — SEF | `@verifaktura/cius-rs` | planned |
| Bosnia and Herzegovina — FBiH | `@verifaktura/cius-ba` | pending regulations |

A national CIUS sometimes requires elements that CEN syntax rules forbid — the
Croatian eRačun needs `cbc:IssueTime`, while `UBL-CR-006` says it should not be
there. A profile declares such rules through `overrides`: the finding stays in
the report but drops to `info` with a note naming the profile that overrides it.
Nothing is hidden, nothing cries wolf.

## Report

```jsonc
{
  "reportVersion": "1.0",
  "valid": false,
  "document": { "syntax": "ubl", "type": "invoice", "id": "2026-001", "currency": "EUR", … },
  "profiles": [{ "id": "en16931", "version": "1.3.16", "source": "CEN/TC 434" }],
  "summary": { "fatal": 1, "warning": 0, "info": 0, "rulesFired": 211, "durationMs": 272 },
  "issues": [{
    "ruleId": "BR-02",
    "severity": "fatal",
    "profile": "en16931",
    "businessTerms": ["BT-1"],
    "location": { "xpath": "/*:Invoice[1]" },
    "message": "Račun mora sadržavati broj računa (BT-1).",
    "messages": { "en": "…", "hr": "…", "bs": "…", "sr": "…" }
  }]
}
```

`businessTerms` is deliberately a separate array — integrators map a finding
onto a field in their own ERP through the BT number, without parsing text.

The format is versioned (`reportVersion`) and documented in
[FORMAT.md](https://github.com/verifaktura/verifaktura/blob/main/FORMAT.md).

## Generating invoices

The same model works in reverse.
[`@verifaktura/build`](https://www.npmjs.com/package/@verifaktura/build) builds
an invoice that `verifaktura` validates cleanly. VAT breakdown and totals are
computed automatically, using integer arithmetic.

## No JVM

Schematron runs through Saxon-JS as a precompiled SEF — no Java, plain Node,
~250 ms per document.

## Licence

The code is Apache-2.0.

This package ships precompiled CEN/TC 434 validation artefacts
(`sef/*.sef.json`) which keep their own licence — **EUPL 1.2**. Attribution and
details in [NOTICE](https://github.com/verifaktura/verifaktura/blob/main/NOTICE).
