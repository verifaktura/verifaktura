# @verifaktura/cli

CLI za validaciju e-faktura prema EN 16931.

```bash
npx @verifaktura/cli racun.xml --lang hr
```

```
Faktura 12115118 - UBL
  Izdavatelj: De Koksmaat
  Za plaćanje: 250.33 EUR

GREŠKA  BR-02        Račun mora sadržavati broj računa (BT-1).
                     termovi: BT-1

NEVALIDNO - 1 grešaka, 0 upozorenja (211 pravila, 272 ms)
```

## Opcije

| | |
|---|---|
| `--lang <en\|hr\|bs\|sr>` | jezik poruka (default `en`) |
| `--format <text\|json>` | format izlaza (default `text`) |
| `--quiet` | samo izlazni kod |
| `-h`, `--help` | pomoć |

Izlazni kod: `0` validno, `1` ima fatalnih grešaka, `2` greška u radu — pa se
može koristiti u CI-u:

```bash
npx @verifaktura/cli racuni/*.xml --quiet || echo "neispravan racun"
```

Detalji i programsko korištenje: [verifaktura](https://www.npmjs.com/package/verifaktura).

## Licenca

Apache-2.0
