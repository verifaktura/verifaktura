# @verifaktura/cli

Command line validation of EN 16931 e-invoices.

```bash
npx @verifaktura/cli invoice.xml --lang hr
```

```
Faktura 12115118 - UBL
  Izdavatelj: De Koksmaat
  Za plaćanje: 250.33 EUR

GREŠKA  BR-02        Račun mora sadržavati broj računa (BT-1).
                     termovi: BT-1

NEVALIDNO - 1 grešaka, 0 upozorenja (211 pravila, 272 ms)
```

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
