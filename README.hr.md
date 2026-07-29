# verifaktura

Validacija i generiranje **EN 16931** eRačuna — UBL 2.1 i CII D16B — s hrvatskim
CIUS profilom za Fiskalizaciju 2.0 i porukama pravila na hrvatskom.

*English: [README.md](./README.md)*

```bash
npm install verifaktura @verifaktura/cius-hr
```

```ts
import { validate } from "verifaktura";
import "@verifaktura/cius-hr";   // registrira hrvatski profil

const report = await validate(xml, { lang: "hr" });

for (const issue of report.issues) {
  console.log(issue.ruleId, issue.message);
  // HR-BR-25  Stavka 1: Svaki artikl MORA imati identifikator klasifikacije...
}
```

## Zašto

Porezna uprava je 13. ožujka 2026. objavila dorađenu verziju validatora, u
primjeni od 15. ožujka. Tko je pravila prepisao u vlastiti kod, tog je dana
zastario — i sazna to tek kad mu eRačun bude odbijen.

verifaktura ne prepisuje pravila. Preuzima službene artefakte s
[porezna.gov.hr](https://porezna.gov.hr/fiskalizacija/bezgotovinski-racuni/eracun)
i CEN/TC 434 pri buildu, a CI javlja kad izađe nova verzija.

Schematron se izvršava kroz Saxon-JS kao prekompilirani SEF — bez JVM-a,
~250 ms po dokumentu.

## Hrvatski profil

Primjenjuje se na UBL dokumente s oznakom specifikacije:

```
urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0#conformant#urn:mfin.gov.hr:ext-2025:1.0
```

Profil se bira automatski prema `cbc:CustomizationID`. Pokriva CIUS i
proširenja, uključujući OIB kontrolu i KPD 2025 klasifikaciju.

Detalji i mapiranje pravila na polja: [packages/cius-hr](./packages/cius-hr).

## Generiranje eRačuna

`@verifaktura/build` gradi dokument koji odmah prolazi i EN 16931 i hrvatsku
validaciju:

```ts
import { buildUbl } from "@verifaktura/build";
import { HR_CUSTOMIZATION_ID } from "@verifaktura/cius-hr";

const xml = buildUbl({
  customizationId: HR_CUSTOMIZATION_ID,
  profileId: "P1",                    // HR-BR-34
  id: "2026-001",
  issueDate: "2026-07-29",
  issueTime: "10:15:00",              // HR-BR-2
  dueDate: "2026-08-28",              // HR-BR-4
  currency: "EUR",
  seller: { …, contact: { name: "Operater 1", id: oib } },   // HR-BR-37, HR-BR-9
  buyer,
  lines: [{
    name: "Usluga razvoja softvera", quantity: "10", unitPrice: "80.00",
    vatCategory: "S", vatRate: "25", unitCode: "HUR",
    classification: { value: "62.10.11", scheme: "CG" },     // HR-BR-25
  }],
});
```

Rekapitulacija PDV-a i ukupni iznosi računaju se automatski, aritmetika je u
cijelim brojevima — nema float pogreške koja ruši dokument na BR-CO-15.

## Paketi

| Paket | Što radi |
|---|---|
| [`verifaktura`](./packages/core) | validacijski engine |
| [`@verifaktura/build`](./packages/build) | gradi valjane EN 16931 račune |
| [`@verifaktura/cius-hr`](./packages/cius-hr) | hrvatski profil |
| [`@verifaktura/cli`](./packages/cli) | naredbeni redak |

## Licencija

Kod je pod [Apache-2.0](./LICENSE). Validacijski artefakti zadržavaju licenciju
svog izvora — vidi [NOTICE](./NOTICE).
