# Doprinos projektu

## Postavljanje

```bash
npm install
npm run prepare:sef   # preuzima CEN i HR artefakte, kompajlira u SEF (~1-2 min)
npm test
npm run build
node scripts/e2e.mjs  # stvarna validacija kontrolnih faktura
```

`prepare:sef` traži mrežni pristup. Bez hrvatskog profila: `SKIP_HR=1 npm run prepare:sef`.

## Prijevodi pravila

Poruke se NE uređuju u `packages/core/src/catalog/rules.json` — taj fajl je generisan.

- ručni prijevodi: `scripts/messages.manual.json`
- šabloni (PDV kategorije, decimale): `scripts/gen-messages.py`
- regeneracija: `python3 scripts/gen-messages.py`

Test `messages.test.ts` čuva pokrivenost i semantiku. Posebno pazi na sufikse
09 i 10 kod PDV porodica — značenje se **invertira** između oporezivih i
oslobođenih kategorija (razlog oslobođenja je kod jednih zabranjen, kod drugih
obavezan). Pogrešna poruka je gora od nikakve.

## Novi CIUS profil

1. Novi paket `packages/cius-<zemlja>`.
2. Izvezi `ProfileDefinition` i pozovi `registerProfile()`.
3. Dodaj preuzimanje artefakata u `scripts/build-sef.mjs`.
4. Dodaj kontrolnu fakturu u `packages/core/test/fixtures` i slučaj u `scripts/e2e.mjs`.

Nacionalni artefakti se **ne commit-uju** — preuzimaju se pri buildu da se nikad
ne validira po zastarjelim pravilima.

## Format izvještaja

`FORMAT.md` je API ugovor. Nova opcionalna polja su minor promjena; sve ostalo
traži podizanje `reportVersion`.
