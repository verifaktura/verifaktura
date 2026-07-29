# Objavljivanje

Objava ide preko **npm trusted publishing (OIDC)** — nema tokena u GitHub
secrets. Svaka objava je kratkotrajni, workflow-specifičan kredencijal koji se
ne može iscuriti ni ponovo upotrijebiti, i automatski nosi provenance.

## Jednokratno postavljanje

### 1. GitHub

```bash
git push -u origin main
```

Repo mora biti **public** — provenance se ne generiše iz privatnih repozitorija.

Preporučeno uz to: zaštita tagova (Settings → Rules), da objavu može pokrenuti
samo onaj ko smije praviti `v*` tagove.

### 2. Prva objava — ručno

Trusted publisher se podešava na stranici paketa, a stranica postoji tek kad
paket postoji. Zato prva objava ide s tvoje mašine:

```bash
npm login                     # 2FA
npm run prepare:sef
npm run build
npm test && node scripts/e2e.mjs && node scripts/roundtrip.mjs

npm publish -w verifaktura
npm publish -w @verifaktura/build
npm publish -w @verifaktura/cius-hr
npm publish -w @verifaktura/cli
```

### 3. Trusted publisher — za svaki od četiri paketa

npmjs.com → Packages → *paket* → Settings → **Trusted Publisher** → GitHub Actions:

| Polje | Vrijednost |
|---|---|
| Organization or user | `verifaktura` |
| Repository | `verifaktura` |
| Workflow filename | `release.yml` |
| Environment name | *(prazno)* |
| Allowed actions | `npm publish` |

Sva polja su osjetljiva na velika/mala slova i moraju biti tačna — npm ih ne
provjerava pri spremanju, greška se vidi tek pri objavi.

### 4. Zatvori vrata tokenima

Za svaki paket: Settings → **Publishing access** →
*„Require two-factor authentication and disallow tokens"*.

Trusted publishing nastavlja raditi (koristi OIDC, ne token), a klasični tokeni
prestaju biti put do objave.

## Svaka sljedeća objava

```bash
npm version patch -w verifaktura   # ili minor/major
git push && git push --tags
```

Tag `v*` pokreće `release.yml`: typecheck → testovi → priprema artefakata →
build → e2e i round-trip → objava sva četiri paketa.

## Zahtjevi i zamke

- Node ≥ 22.14 i npm ≥ 11.5.1 (workflow koristi Node 24).
- Samo GitHub-hosted runneri; self-hosted nisu podržani.
- `repository.url` u `package.json` mora **tačno** odgovarati GitHub repou —
  inače objava pada na autentifikaciji.
- `--provenance` se ne navodi; kod trusted publishinga se generiše sam.
- Verzije paketa drži usklađene: `@verifaktura/cli` i `@verifaktura/cius-hr`
  zavise od `verifaktura` preko `^` raspona.

## Ako objava padne s ENEEDAUTH

Redom provjeri: naziv workflow fajla (uključujući `.yml`), organizaciju i
repozitorij u trusted publisher konfiguraciji, `id-token: write` u workflowu, i
`repository.url` u `package.json` paketa koji se objavljuje.
