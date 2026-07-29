# verifaktura

Validacija i generisanje e-faktura prema **EN 16931** — UBL 2.1 i CII D16B — s
nacionalnim CIUS profilima i porukama pravila na hrvatskom, bosanskom i srpskom.

```bash
npm install verifaktura @verifaktura/build
```

```ts
import { buildUbl, simpleInvoice } from "@verifaktura/build";
import { validate } from "verifaktura";

const xml = buildUbl(simpleInvoice({
  id: "2026-001", issueDate: "2026-07-29", currency: "BAM", vatRate: "17",
  seller, buyer,
  lines: [{ name: "Razvoj softvera", quantity: 10, unitPrice: "80.00" }],
}));

const report = await validate(xml, { lang: "bs" });
// report.valid === true
```

Kad nešto ne valja, izvještaj kaže šta i gdje:

```
GREŠKA  BR-02   Faktura mora sadržavati broj fakture (BT-1).   termovi: BT-1
```

## Paketi

| Paket | Šta radi |
|---|---|
| [`verifaktura`](./packages/core) | validacioni engine |
| [`@verifaktura/build`](./packages/build) | gradi validne EN 16931 fakture |
| [`@verifaktura/cius-hr`](./packages/cius-hr) | hrvatski profil (Fiskalizacija 2.0) |
| [`@verifaktura/cli`](./packages/cli) | CLI |

Planirano: `@verifaktura/cius-rs` (Srbija, SEF), `@verifaktura/cius-ba`
(FBiH, čeka podzakonske akte).

## Zašto

Validacijska pravila se mijenjaju usred mandata — hrvatska Porezna uprava je
objavila dorađenu verziju validatora u martu 2026. Ko ih je prepisao u kod, od
tada je zastario i to sazna tek kad mu račun bude odbijen.

verifaktura ne prepisuje pravila. Povlači službene artefakte (CEN/TC 434,
Porezna uprava RH) pri buildu, a CI javlja kad izađe nova verzija.

Schematron se izvršava kroz Saxon-JS kao prekompajlirani SEF — bez JVM-a,
~250 ms po dokumentu.

## Status

| | |
|---|---|
| EN 16931, UBL | validacija i generisanje |
| EN 16931, CII | validacija; sažetak dokumenta još samo za UBL |
| Lokalizacija (hr/bs/sr) | 223/223 business pravila (BR-*) |
| HR CIUS | radi, uključujući HR proširenja |

Poznata ograničenja: `location.line` i `column` nisu popunjeni (samo XPath),
generisanje CII-ja nije implementirano.

## Razvoj

```bash
npm install
npm run prepare:sef   # preuzima i kompajlira validacione artefakte, ~2 min
npm test
npm run build

node scripts/e2e.mjs        # validacija kontrolnih faktura
node scripts/roundtrip.mjs  # build -> validate
```

`prepare:sef` traži mrežni pristup. Bez hrvatskog profila:
`SKIP_HR=1 npm run prepare:sef`.

Format izvještaja: [FORMAT.md](./FORMAT.md) ·
doprinos: [CONTRIBUTING.md](./CONTRIBUTING.md) ·
objava: [RELEASING.md](./RELEASING.md)

## Licenca

Kod je pod [Apache-2.0](./LICENSE).

Validacioni artefakti nisu dio ovog repozitorija — preuzimaju se pri buildu i u
objavljenim npm paketima zadržavaju licencu svog izvora. Atribucija:
[NOTICE](./NOTICE).
