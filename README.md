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

## Struktura

```
packages/core     verifaktura            — validacioni engine
packages/cli      @verifaktura/cli       — CLI
packages/cius-hr  @verifaktura/cius-hr   — HR pravila (Fiskalizacija 2.0)   [planirano]
packages/cius-sef @verifaktura/cius-sef  — Srbija SEF                        [planirano]
scripts/build-sef.mjs                     — kompajlira CEN XSLT u SEF
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

v0.1.0 — EN 16931 osnovni profil za UBL radi end-to-end. U izradi: CII sažetak dokumenta,
HR CIUS, prošireni katalog lokalizovanih poruka.

## Licenca

Apache-2.0. CEN validacioni artefakti su pod EUPL 1.2 i nisu dio ovog repozitorija.
