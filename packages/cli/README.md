# @verifaktura/cli

Command line validation of EN 16931 e-invoices.

```bash
npx @verifaktura/cli invoice.xml --lang hr
```

National CIUS profiles load automatically when installed:

```bash
npm i @verifaktura/cli @verifaktura/cius-hr
npx verifaktura eracun.xml --lang hr
```

```
Račun (bez broja) - UBL
  Izdavatelj: De Koksmaat
  Za plaćanje: 250.33 EUR

GREŠKA  BR-02        Račun mora sadržavati broj računa (BT-1).
                     pojmovi: BT-1
GREŠKA  BR-03        Račun mora sadržavati datum izdavanja (BT-2).
                     pojmovi: BT-2

NEVALIDNO - 2 greške, 0 upozorenja (profili: en16931; 211 pravila, 1262 ms)
```

The report frame follows `--lang` too, with correct plural forms
(`1 greška`, `2 greške`, `5 grešaka`). Without `--lang` the output is English.

Each call starts a new process and loads the rules, so expect about 1.3 s per
call. To validate many files, use the library from one process — after the
first document each one takes about 200–270 ms.

## Options

| | |
|---|---|
| `--lang <en\|hr\|bs\|sr>` | message language (default `en`) |
| `--format <text\|json>` | output format (default `text`) |
| `--quiet` | exit code only |
| `-h`, `--help` | help |

Exit codes: `0` valid, `1` fatal findings, `2` execution error — so it works in
CI:

```bash
npx @verifaktura/cli invoices/*.xml --quiet || echo "invalid invoice"
```

Programmatic use and report format:
[`verifaktura`](https://www.npmjs.com/package/verifaktura).

## Licence

Apache-2.0
