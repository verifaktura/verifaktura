# @verifaktura/cius-hr

Hrvatski CIUS profil (Fiskalizacija 2.0) za `verifaktura` validator.

```ts
import { validate } from "verifaktura";
import "@verifaktura/cius-hr";   // registruje profil

const report = await validate(xml, { lang: "hr" });
// report.profiles -> [{ id: "en16931", ... }, { id: "hr", version: "2026-03-15", ... }]
```

Profil se primjenjuje **isključivo** na UBL dokumente s oznakom specifikacije:

```
urn:cen.eu:en16931:2017#compliant#urn:mfin.gov.hr:cius-2025:1.0#conformant#urn:mfin.gov.hr:ext-2025:1.0
```

Izvezena je kao `HR_CUSTOMIZATION_ID`.

> Napomena: opis na stranici Porezne uprave ima fusnotu koja se pri kopiranju
> uvuče u string i daje `ext[1]2025` umjesto `ext-2025`. Vrijednost u ovom
> paketu je preuzeta iz samog schematrona (pravilo HR-BR-5).

## Artefakti

Ne distribuiraju se s paketom. `npm run prepare:sef` preuzima ZIP s
porezna.gov.hr (dokument 197) i kompajlira ga kroz ISO Schematron lanac —
za razliku od CEN-a, Porezna uprava isporučuje **sirovi** `.sch`, ne
prekompajlirani XSLT.

## Što HR profil traži preko EN 16931

Nalazi iz stvarnog izvršavanja schematrona nad minimalnim validnim
EN 16931 dokumentom. Ovo je ujedno lista koju `@verifaktura/build` još ne
pokriva:

| Pravilo | Zahtjev | Polje u `@verifaktura/build` |
|---|---|---|
| HR-BR-2 | vrijeme izdavanja (HR-BT-2), `hh:mm:ss` | `issueTime` |
| HR-BR-37 | oznaka operatera (HR-BT-4) | `seller.contact.name` |
| HR-BR-9 | OIB operatera (HR-BT-5) s kontrolnom znamenkom | `seller.contact.id` |
| HR-BR-25 / HR-BR-CL-2 | klasifikacija artikla po KPD 2025, `listID="CG"`, format `62.10.11` | `line.classification` |
| HR-BR-34 | oznaka procesa (BT-23): P1–P12 ili `P99:<oznaka>` | `profileId` |
| HR-BR-53 | OIB prodavca mora proći kontrolu | `seller.vatId` (prefiks `HR` je dozvoljen) |
| HR-BR-4 | datum dospijeća kad je iznos za plaćanje > 0 | `dueDate` |
| HR-BR-S-1 | PDV ID kupca kad je kategorija „S" | `buyer.vatId` |

Ispravnost OIB-a možeš provjeriti prije gradnje:

```ts
import { isValidOib } from "@verifaktura/build";
isValidOib("12345678903");   // true
```

## Sukob s CEN sintaksnim pravilima

HR CIUS traži elemente koje CEN označava s „should not include":

| CEN pravilo | Element | Traži ga |
|---|---|---|
| UBL-CR-006 | `cbc:IssueTime` | HR-BR-2 |
| UBL-CR-200 | `cac:SellerContact` | HR-BR-37, HR-BR-9 |

Profil ih deklariše kroz `overrides`, pa se spuštaju na `info` s napomenom koji
ih profil nadjačava. Ne skrivaju se — ispravan hrvatski račun bi inače uvijek
vraćao dva upozorenja, a upozorenje koje uvijek gori korisnik nauči ignorisati.

## Licenca

Apache-2.0. Schematron artefakti su vlasništvo Ministarstva financija —
Porezne uprave RH i ne distribuiraju se ovim paketom.
