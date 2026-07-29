# verifaktura

Validacija e-faktura prema **EN 16931** — UBL 2.1 i CII D16B — s nacionalnim CIUS profilima
(Hrvatska / Fiskalizacija 2.0, Srbija / SEF, BiH / FBiH) i **porukama pravila na lokalnim jezicima**.

Referentni validatori vraćaju samo engleski tekst i XPath. verifaktura vraća strukturiran
izvještaj s ID-em pravila, business termovima (BT/BG), lokacijom i porukom na hr/bs/sr —
što je razlika između "nešto ne valja" i "dodaj broj računa".

```bash
npm install verifaktura
npx verifaktura racun.xml --lang hr
```

```
Faktura 12115118 - UBL
  Izdavatelj: De Koksmaat
  Za plaćanje: 250.33 EUR

GREŠKA  BR-02        Račun mora sadržavati broj računa (BT-1).
                     termovi: BT-1

NEVALIDNO - 1 grešaka, 0 upozorenja (211 pravila, 272 ms)
```

## Programski

```ts
import { validate } from "verifaktura";

const report = await validate(xml, { lang: "hr" });
if (!report.valid) {
  for (const issue of report.issues) {
    console.log(issue.ruleId, issue.severity, issue.message);
  }
}
```

Format izvještaja je dokumentovan u [FORMAT.md](./FORMAT.md) i verzionisan (`reportVersion`).

## Generisanje

Isti model radi i u drugom smjeru — `@verifaktura/build` gradi fakturu koju
`verifaktura` odmah može validirati:

```ts
import { buildUbl, simpleInvoice } from "@verifaktura/build";
import { validate } from "verifaktura";

const xml = buildUbl(simpleInvoice({
  id: "2026-001", issueDate: "2026-07-29", currency: "BAM", vatRate: "17",
  seller, buyer, lines: [{ name: "Razvoj softvera", quantity: 10, unitPrice: "80.00" }],
}));

await validate(xml);   // valid: true
```

Rekapitulacija PDV-a i ukupni iznosi se računaju automatski, aritmetika je u
cijelim brojevima (bez float greške). Detalji: [packages/build](./packages/build).

## Nacionalni profili

CIUS profili se izvršavaju **nakon** osnovne EN 16931 validacije i biraju se
automatski prema `cbc:CustomizationID`:

```ts
import { validate } from "verifaktura";
import "@verifaktura/cius-hr";   // registruje hrvatski profil

const report = await validate(xml, { lang: "hr" });
// report.profiles -> [{ id: "en16931", ... }, { id: "hr", ... }]
```

Artefakti nacionalnih profila se **ne distribuiraju** s paketom — preuzimaju se
pri buildu s izvora (Porezna uprava RH, CEN), da se nikad ne validira po
zastarjelim pravilima.

## Struktura

```
packages/core     verifaktura            — validacioni engine
packages/build    @verifaktura/build     — gradi validne EN 16931 fakture
packages/cli      @verifaktura/cli       — CLI
packages/cius-hr  @verifaktura/cius-hr   — HR profil (Fiskalizacija 2.0)
packages/cius-sef @verifaktura/cius-sef  — Srbija SEF                    [planirano]
packages/cius-ba  @verifaktura/cius-ba   — FBiH CPF                      [čeka pravilnike]
scripts/build-sef.mjs                     — preuzima i kompajlira artefakte u SEF
scripts/gen-messages.py                   — generiše katalog lokalizovanih poruka
scripts/e2e.mjs                           — validacija kontrolnih faktura
scripts/roundtrip.mjs                     — build -> validate provjera
```

## Razvoj

```bash
npm install
npm run prepare:sef   # skida CEN artefakte (v1.3.16) i kompajlira u SEF, ~1 min
npm test
npm run build
```

`prepare:sef` klonira [ConnectingEurope/eInvoicing-EN16931](https://github.com/ConnectingEurope/eInvoicing-EN16931)
i Saxon-JS `xslt3` alatom kompajlira Schematron XSLT u SEF format. SEF fajlovi nisu u repou
(6+ MB) nego se generišu i objavljuju uz npm paket.

## Status

v0.1.0

| | |
|---|---|
| EN 16931 UBL | radi end-to-end |
| EN 16931 CII | validacija radi; sažetak dokumenta još samo za UBL |
| Lokalizacija (hr/bs/sr) | 223/223 business pravila (BR-*) |
| HR CIUS | profil registrovan, artefakti se preuzimaju pri buildu |
| Generisanje (UBL) | radi; 5 round-trip slučajeva prolazi validaciju |
| Generisanje (CII) | u planu |
| Hosted API | u planu |

Poznata ograničenja: `location.line`/`column` još nisu popunjeni (samo XPath),
CII sažetak dokumenta nije implementiran.

## Licenca

Kod je pod Apache-2.0.

Validacioni artefakti nisu dio ovog repozitorija — preuzimaju se skriptom
`npm run prepare:sef`. U objavljene npm pakete ulaze prekompajlirani i tamo
zadržavaju licencu svog izvora (CEN/TC 434 pod EUPL 1.2, HR CIUS uz navođenje
izvora). Atribucija: [NOTICE](./NOTICE).
