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

### 2. Prva objava — bootstrap

Trusted publisher se podešava na stranici paketa, a stranica postoji tek kad
paket postoji. Prvu objavu zato ne može odraditi OIDC. Dvije opcije:

**A — jednokratni token, pipeline radi sve** (preporučeno ako ne želiš ništa
lokalno):

1. npmjs.com → Access Tokens → **Granular access token**
   - Packages and scopes: `Read and write`, opseg **All packages**
     (unscoped paket `verifaktura` NIJE u scope-u `@verifaktura`)
   - ✅ **Bypass two-factor authentication** — bez toga npm vraća
     `E403 ... Two-factor authentication or granular access token with bypass
     2fa enabled is required to publish packages`
   - Expiration: **7 dana** — token živi samo koliko traje bootstrap
2. GitHub → Settings → Secrets → Actions → novi secret `NPM_TOKEN`
3. Privremeno dodaj u `release.yml`, u korak „Objavi pakete":
   ```yaml
   env:
     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```
4. Pokreni Actions → Release → `minor`
5. Nakon uspjeha: **vrati `release.yml` na verziju bez `env:`**, obriši secret,
   opozovi token.

**B — jednom ručno s tvoje mašine:**

```bash
npm login                     # 2FA
./scripts/publish-local.sh --otp
```

Skript prođe sve provjere pa traži svjež 2FA kod za svaki paket (kod vrijedi
~30 s). Ručno je isto:

```bash
npm publish -w verifaktura --otp=123456
npm publish -w @verifaktura/build --otp=123456
npm publish -w @verifaktura/cius-hr --otp=123456
npm publish -w @verifaktura/cli --otp=123456
```

Opcija B je manje koraka i ne traži da ijedan token ikad postoji. Opcija A je
bolja ako nemaš npm postavljen lokalno ili želiš da sve ide kroz CI od prvog
dana.

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

**Ništa lokalno.** GitHub → Actions → **Release** → Run workflow → odaberi
`patch`, `minor` ili `major`.

Pipeline redom: `npm ci` → typecheck → testovi → priprema artefakata → build →
e2e → round-trip → **tek onda** podigne verziju, commita, tagira i objavi.
Redoslijed je namjeran: ako bilo šta padne, verzija se nije ni pomjerila, pa
nema praznog taga ni preskočenog broja.

Postoji i `dry_run` opcija — prođe sve provjere i preskoči objavu. Korisno kad
mijenjaš sam workflow.

Alternativno, ako verziju dižeš ručno, push taga `v*` pokreće isti pipeline bez
koraka verzionisanja.

### Verzionisanje u lockstepu

Sva četiri paketa uvijek idu na istu verziju, a `scripts/version.mjs` usklađuje
i interne raspone zavisnosti (`@verifaktura/cli` → `verifaktura: ^x.y.z`).
`npm version --workspaces` to ne radi pouzdano, zato zaseban skript.

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
