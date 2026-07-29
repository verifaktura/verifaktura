# @verifaktura/build

Gradi EN 16931 e-fakture (UBL 2.1) iz tipiziranog modela. Izlaz je provučen kroz
`verifaktura` validator u CI-u — to je razlika između generatora XML-a i
generatora *validnog* XML-a.

## Dva nivoa

**`simpleInvoice`** — tipičan račun: jedna PDV stopa, bez popusta na dokumentu.

```ts
import { buildUbl, simpleInvoice } from "@verifaktura/build";

const xml = buildUbl(simpleInvoice({
  id: "2026-001",
  issueDate: "2026-07-29",
  dueDate: "2026-08-28",
  currency: "BAM",
  vatRate: "17",
  iban: "BA391941051193401279",
  seller: {
    name: "Moja firma d.o.o.",
    vatId: "BA210300400000",      // prefiks države je obavezan (BR-CO-09)
    address: { street: "Ulica 1", city: "Mostar", postalCode: "88000", country: "BA" },
  },
  buyer: {
    name: "Kupac d.o.o.",
    address: { street: "Ulica 2", city: "Sarajevo", postalCode: "71000", country: "BA" },
  },
  lines: [{ name: "Razvoj softvera", quantity: 10, unitPrice: "80.00" }],
}));
```

**Puni `Invoice` model** — više PDV stopa, popusti i troškovi na razini
dokumenta i stavke, odobrenja (CreditNote), oslobođenja s razlogom.
`simpleInvoice` je tanak sloj iznad njega, ne zaseban put — možeš početi
jednostavno i dograđivati.

```ts
const xml = buildUbl({
  id: "2026-003", issueDate: "2026-07-29", currency: "EUR",
  seller, buyer,
  lines: [
    { name: "Usluga A", quantity: "1", unitPrice: "100.00", vatCategory: "S", vatRate: "25" },
    { name: "Usluga B", quantity: "2", unitPrice: "50.00",  vatCategory: "S", vatRate: "13" },
  ],
  allowances: [{ amount: "10.00", reason: "Rabat",   vatCategory: "S", vatRate: "25" }],
  charges:    [{ amount: "5.00",  reason: "Dostava", vatCategory: "S", vatRate: "25" }],
});
```

## Šta se računa automatski

Ako izostaviš `vatBreakdown` i `totals`, računaju se iz stavki:

- rekapitulacija PDV-a grupisana po kategoriji i stopi (BG-23)
- osnovica po grupi = Σ stavke + Σ troškovi − Σ popusti (BR-S-08 i srodna)
- iznos PDV-a = osnovica × stopa / 100, half-up na 2 decimale (BR-CO-17)
- PDV = 0 za AE, K, G, O kategorije (BR-AE-09 i srodna)
- svi ukupni iznosi (BR-CO-10 do BR-CO-16)

Možeš ih i navesti eksplicitno — korisno kad preslikavaš postojeći dokument i
želiš zadržati original čak i ako se ne slaže s izračunom.

## Novac

Sve se drži kao `bigint` u stotinkama, nigdje `number`. Float bi značio da
`0.1 + 0.2 !== 0.3` obara dokument na BR-CO-15 ili BR-CO-17 — a takav bug se
pojavi tek kod klijenta, na desetoj fakturi.

Iznosi su stringovi (`"1234.56"`); prihvata se i zarez (`"1234,56"`).

## Model prati BT/BG oznake

Svako polje je dokumentovano svojim EN 16931 terminom. Kad validator prijavi
`BT-31`, znaš da je to `seller.vatId` — bez traženja po specifikaciji.

## Licenca

Apache-2.0
