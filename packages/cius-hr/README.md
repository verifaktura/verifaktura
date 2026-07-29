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

| Pravilo | Zahtjev | Status u builderu |
|---|---|---|
| HR-BR-2 | vrijeme izdavanja (HR-BT-2), format `hh:mm:ss` | nije podržano |
| HR-BR-37 | oznaka operatera (HR-BT-4) | nije podržano |
| HR-BR-9 | OIB operatera (HR-BT-5), s kontrolnom znamenkom | nije podržano |
| HR-BR-25 | klasifikacija artikla po KPD 2025 (šesteroznamenkasta) | djelimično — treba ispravan `listID` |
| HR-BR-34 | oznaka procesa (BT-23) iz skupa P1–P12 ili P99 | radi, treba se navesti ručno |
| HR-BR-53 | OIB mora proći kontrolu (ISO 7064 MOD 11,10) | nije podržano |
| HR-BR-4 | datum dospijeća obavezan kad je iznos za plaćanje > 0 | radi, treba se navesti ručno |
| HR-BR-S-1 | PDV ID kupca obavezan kad je kategorija „S" | radi, treba se navesti ručno |

HR-BT-* polja su nacionalno proširenje i traže vlastiti namespace u UBL-u —
zato ih puni EN 16931 model još nema.

## Licenca

Apache-2.0. Schematron artefakti su vlasništvo Ministarstva financija —
Porezne uprave RH i ne distribuiraju se ovim paketom.
