# verifaktura

[![npm](https://img.shields.io/npm/v/verifaktura)](https://www.npmjs.com/package/verifaktura)
[![license](https://img.shields.io/npm/l/verifaktura)](https://github.com/verifaktura/verifaktura/blob/main/LICENSE)

Validacija e-faktura prema **EN 16931** — UBL 2.1 i CII D16B — s nacionalnim CIUS
profilima i **porukama pravila na hrvatskom, bosanskom i srpskom**.

Referentni validatori vrate `[BR-02]-An Invoice shall have an Invoice number (BT-1).`
i XPath. Ovo vrati strukturiran nalaz s ID-em pravila, business termovima,
lokacijom i porukom na jeziku korisnika — razlika između „nešto ne valja" i
„dodaj broj računa".

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

CLI:

```bash
npx @verifaktura/cli racun.xml --lang hr
```

## Zašto ovo, a ne zakucana pravila

Validacijska pravila se mijenjaju usred mandata. Hrvatska Porezna uprava je
objavila dorađenu verziju validatora u martu 2026, u primjeni od 15.3. Svako ko
je pravila prepisao u kod je od tada zastario — i ne zna to dok mu račun ne bude
odbijen.

`verifaktura` ne prepisuje pravila. Povlači službene artefakte (CEN/TC 434,
Porezna uprava RH) pri buildu i ima CI koji javlja kad izađe nova verzija.

## Nacionalni profili

Profili se izvršavaju **nakon** osnovne EN 16931 validacije i biraju se
automatski prema `cbc:CustomizationID`:

```ts
import { validate } from "verifaktura";
import "@verifaktura/cius-hr";   // registruje hrvatski profil

const report = await validate(xml, { lang: "hr" });
// report.profiles -> [{ id: "en16931", ... }, { id: "hr", ... }]
```

| Profil | Paket | Status |
|---|---|---|
| EN 16931 (UBL + CII) | ugrađen | ✅ |
| Hrvatska — Fiskalizacija 2.0 | `@verifaktura/cius-hr` | ✅ |
| Srbija — SEF | `@verifaktura/cius-rs` | planirano |
| BiH — FBiH CPF | `@verifaktura/cius-ba` | čeka pravilnike |

Nacionalni CIUS ponekad traži elemente koje CEN-ova sintaksna pravila zabranjuju
(npr. hrvatski eRačun traži `cbc:IssueTime`, a `UBL-CR-006` kaže da ga ne treba
biti). Profil takva pravila deklariše kroz `overrides` — nalaz ostaje u
izvještaju, ali kao `info` s napomenom koji ga profil nadjačava. Ne skriva se, ne
alarmira.

## Izvještaj

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

`businessTerms` je namjerno zaseban niz — integrator mapira grešku na polje u
svom ERP-u preko BT-broja, bez parsiranja teksta.

Format je verzionisan (`reportVersion`) i dokumentovan u
[FORMAT.md](https://github.com/verifaktura/verifaktura/blob/main/FORMAT.md).

## Generisanje

Isti model radi i u drugom smjeru — [`@verifaktura/build`](https://www.npmjs.com/package/@verifaktura/build)
gradi fakturu koju `verifaktura` odmah može validirati. Rekapitulacija PDV-a i
ukupni iznosi se računaju automatski, aritmetika je u cijelim brojevima.

## Bez Jave

Schematron se izvršava kroz Saxon-JS kao prekompajlirani SEF. Nema JVM-a, radi
u običnom Node procesu, ~250 ms po dokumentu.

## Licenca

Kod je pod Apache-2.0.

Paket sadrži prekompajlirane CEN/TC 434 validacione artefakte (`sef/*.sef.json`)
koji zadržavaju svoju licencu — **EUPL 1.2**. Detalji i atribucija u
[NOTICE](https://github.com/verifaktura/verifaktura/blob/main/NOTICE).
