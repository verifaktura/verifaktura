# Format validacionog izvještaja

Verzionisan kroz polje `reportVersion`. Trenutno **1.0**.

## Primjer

```json
{
  "reportVersion": "1.0",
  "engine": "verifaktura/0.1.4",
  "validatedAt": "2026-07-29T10:47:12.331Z",
  "valid": false,
  "document": {
    "syntax": "ubl",
    "type": "invoice",
    "customizationId": "urn:cen.eu:en16931:2017",
    "currency": "EUR",
    "supplier": { "name": "De Koksmaat", "vatId": "NL8200.98.395.B.01" },
    "customer": { "name": "ODIN 59" },
    "payableAmount": "250.33"
  },
  "profiles": [{ "id": "en16931", "version": "1.3.16", "source": "CEN/TC 434" }],
  "summary": { "fatal": 1, "warning": 0, "info": 0, "rulesFired": 211, "durationMs": 278 },
  "issues": [
    {
      "ruleId": "BR-02",
      "severity": "fatal",
      "profile": "en16931",
      "businessTerms": ["BT-1"],
      "location": { "xpath": "/*:Invoice[1]" },
      "message": "Faktura mora sadržavati broj fakture (BT-1).",
      "messages": {
        "en": "An Invoice shall have an Invoice number (BT-1).",
        "hr": "Račun mora sadržavati broj računa (BT-1).",
        "bs": "Faktura mora sadržavati broj fakture (BT-1).",
        "sr": "Faktura mora da sadrži broj fakture (BT-1)."
      }
    }
  ]
}
```

## Polja

| Polje | Značenje |
|---|---|
| `valid` | `true` kad nema nijednog `fatal` nalaza. Upozorenja ne obaraju dokument. |
| `document` | Sažetak dokumenta iz zaglavlja. Za CII se popunjavaju samo `syntax` i `type`. |
| `profiles[]` | Koji su profili izvršeni i s kojom verzijom artefakata. |
| `summary.rulesFired` | Broj izvršenih Schematron pravila. |
| `issues[].ruleId` | ID pravila, npr. `BR-02`, `HR-BR-25`, `UBL-CR-006`. |
| `issues[].severity` | `fatal`, `warning` ili `info`. |
| `issues[].profile` | Koji profil je prijavio nalaz — `en16931`, `hr`, … |
| `issues[].businessTerms` | EN 16931 termovi na koje se pravilo odnosi, npr. `["BT-1"]`. |
| `issues[].location.xpath` | Lokacija u dokumentu. `line` i `column` su opcionalni i trenutno se ne popunjavaju. |
| `issues[].message` | Poruka na traženom jeziku, s fallbackom na engleski. |
| `issues[].messages` | Svi dostupni prevodi. |
| `issues[].hint` | Opcionalna uputa. Popunjena i kad nacionalni profil nadjačava pravilo. |

## Zašto je ovako

**`businessTerms` je zaseban niz.** Integrator mapira grešku na polje u svom
ERP-u preko BT-broja, bez parsiranja teksta poruke. To je praktično najkorisniji
dio izvještaja.

**I `message` i `messages`.** `message` je već razriješen jezik — to treba
većini. `messages` postoji za UI koji sam bira jezik, i štedi ponovni poziv.

**`profile` na svakom nalazu.** Kad se slože EN 16931 i nacionalni CIUS, mora se
znati čije je pravilo palo — nacionalna i evropska greška se različito rješavaju.

**`profiles[]` nosi verziju artefakata.** Isti dokument uz drugu verziju pravila
daje drugi rezultat. Bez toga izvještaj nije reproducibilan ni upotrebljiv kao
audit trag.

**`rulesFired` je sanity check.** Sumnjivo nizak broj znači da dokument nije
prošao pravu validaciju (najčešće pogrešan namespace), a ne da je ispravan.

**Nadjačana pravila se ne brišu.** Kad nacionalni CIUS traži element koji CEN-ovo
sintaksno pravilo zabranjuje, nalaz ostaje u izvještaju ali kao `info`, uz
`hint` koji kaže koji ga profil nadjačava. Skrivanje bi značilo da korisnik ne
može provjeriti zašto se profili razilaze.

## Stabilnost

- Nova opcionalna polja — minor promjena, `reportVersion` ostaje isti.
- Promjena značenja, uklanjanje polja ili promjena tipa — `reportVersion` 2.0.
- Nove vrijednosti za `severity`, `syntax` ili `profile` — minor. Klijenti moraju
  tolerisati vrijednosti koje ne poznaju.
