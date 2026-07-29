# Format validacionog izvještaja — v1.0

> **Ovo je API ugovor.** Kad se objavi, mijenja se samo uz podizanje `reportVersion`.
> Traži se tvoj review prije nego ga zacementiramo (Faza 1, najvažnija odluka).

## Primjer (stvarni izlaz, ne izmišljen)

```json
{
  "reportVersion": "1.0",
  "engine": "verifaktura/0.1.0",
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
  "summary": { "fatal": 2, "warning": 0, "info": 0, "rulesFired": 211, "durationMs": 278 },
  "issues": [
    {
      "ruleId": "BR-02",
      "severity": "fatal",
      "profile": "en16931",
      "businessTerms": ["BT-1"],
      "location": { "xpath": "/*:Invoice[...][1]" },
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

## Odluke i obrazloženja

| Odluka | Zašto |
|---|---|
| `valid` je izvedeno iz `summary.fatal === 0` | Jedna boolean vrijednost koju integrator provjerava; warning ne obara dokument. |
| I `message` i `messages` | `message` = već razriješen jezik (99% korisnika); `messages` = svi prevodi, za UI koji sam bira. Duplikat je namjeran, štedi round-trip. |
| `businessTerms` kao poseban niz | Integrator mapira grešku na polje u svom ERP-u preko BT-broja, ne parsiranjem teksta. Ovo je najveća praktična vrijednost izvještaja. |
| `profile` na svakom nalazu | Kad se slože EN 16931 + HR CIUS + Peppol, korisnik mora znati čije pravilo je palo — HR greška i EU greška se različito rješavaju. |
| `profiles[]` s verzijom artefakata | Reproducibilnost: isti dokument, druga verzija pravila = drugi rezultat. Za audit trag (i za C angažmane) ovo je obavezno. |
| `location.xpath`, `line`/`column` opcionalni | XPath uvijek dolazi iz SVRL-a. Linija zahtijeva zasebno mapiranje na izvor — v0.2, ne blokira v1 format. |
| `summary.rulesFired` | Sanity check: ako je broj sumnjivo nizak, dokument nije prošao pravu validaciju (npr. pogrešan namespace). Spašava od lažnog "sve je uredu". |
| `hint` opcionalan | Praktična uputa za česta pravila. Koristi se i kad nacionalni profil nadjačava CEN pravilo — tada objašnjava zašto je nalaz spušten na `info`. |
| Nadjačana pravila se ne brišu | Kad HR CIUS traži element koji UBL-CR pravilo zabranjuje, nalaz ostaje u izvještaju ali kao `info`. Skrivanje bi značilo da korisnik ne može provjeriti zašto se profili razilaze. |
| `severity` tri nivoa | `fatal` / `warning` / `info` umjesto CEN-ovog `fatal`/`warning` — `info` ostavlja prostor za successful-report i buduće savjete bez breaking changea. |

## Otvorena pitanja za tvoj review

1. **Redoslijed `issues`** — trenutno redoslijed izvršavanja Schematrona. Alternativa: sortirano po severity pa po lokaciji u dokumentu (bolje za UI, gubi se veza s izvršavanjem). Prijedlog: dodati `?sort=severity` u API, default ostaviti prirodan.
2. **`document` za CII** — trenutno se popunjava samo za UBL. Za CII treba drugi ekstraktor (BG/BT putanje su drugačije). Prihvatljivo da v1 vrati samo `syntax`/`type` za CII?
3. **Prag za `maxIssues`** — koliko nalaza je previše za jedan API odgovor? Prijedlog 500 s `truncated: true` flagom (nije još u shemi).
4. **Da li dodati `raw` polje** sa originalnim SVRL XML-om (opt-in)? Korisno za debug, ali udvostručuje odgovor.

## Stabilnost

- Dodavanje **novih opcionalnih polja** = minor, bez promjene `reportVersion`.
- Promjena značenja, uklanjanje polja, promjena tipa = `reportVersion` 2.0.
- Novi `severity` nivoi ili nove vrijednosti `syntax` = minor (klijenti moraju tolerisati nepoznate vrijednosti — to je dokumentovano očekivanje).
