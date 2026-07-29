# Contributing

## Setup

```bash
npm install
npm test                     # unit tests — no artefacts needed
npm run prepare:sef          # downloads and compiles artefacts, ~2 min
npm run build
npm run test:integration     # tests that actually run Schematron
node scripts/e2e.mjs         # validate reference invoices
node scripts/roundtrip.mjs   # build -> validate
```

`prepare:sef` needs network access. Skip the Croatian profile with
`SKIP_HR=1 npm run prepare:sef`; force recompilation with `FORCE_SEF=1`.

**Unit tests must not require validation artefacts.** `sef/*.json` only exists
after `prepare:sef`, so anything that calls `validate()` belongs in
`packages/*/test/integration/` and runs via `npm run test:integration`, after
the artefacts are in place.

## Documentation language follows the market

- **Core packages** (`verifaktura`, `@verifaktura/build`, `@verifaktura/cli`)
  and repository docs: **English**. The audience is international developers.
- **National profile packages** (`@verifaktura/cius-hr`, and future ones):
  the language of that market. Their only users are in that country, and they
  work with rules written in that language.
- **Market-specific root README** (`README.hr.md`, …) once a market is active.

## Rule translations

Messages are not edited in `packages/core/src/catalog/rules.json` — that file is
generated.

- manual translations: `scripts/messages.manual.json`
- templates (VAT categories, decimals): `scripts/gen-messages.py`
- regenerate: `python3 scripts/gen-messages.py`

`messages.test.ts` guards both coverage and meaning. Pay particular attention to
suffixes 09 and 10 in the VAT category families — the meaning **inverts**
between taxed and exempt categories: an exemption reason is forbidden for one
group and mandatory for the other. A wrong message is worse than none.

## Artefacts: precompiled vs raw Schematron

The source determines the compilation path:

- **CEN** ships precompiled XSLT → straight to `xslt3 -export`.
- **Croatian Tax Administration** (and likely other national sources) ship raw
  `.sch` → through `scripts/schematron.mjs`: resolve `<include>`,
  `iso_abstract_expand`, `iso_svrl_for_xslt2`, then `-export`.

`<include>` is resolved in JavaScript rather than with the `iso_dsdl_include.xsl`
skeleton — that one hits "Maximum call stack size exceeded" under Saxon-JS, and
raising the Node stack size leads to a segfault.

## Adding a CIUS profile

1. New package `packages/cius-<country>`.
2. Export a `ProfileDefinition` and call `registerProfile()`.
3. Add artefact download to `scripts/build-sef.mjs`.
4. Add a reference invoice to `packages/core/test/fixtures` and a case in
   `scripts/e2e.mjs` or `scripts/roundtrip.mjs`.

If the profile requires an element that a CEN syntax rule forbids, list that
rule in `overrides` — the finding drops to `info` with an explanation, instead
of every correct document returning a warning.

Artefacts are **not committed** — they are downloaded at build time so that
validation never runs against stale rules.

## Report format

`FORMAT.md` is an API contract. New optional fields are a minor change;
everything else requires bumping `reportVersion`.
