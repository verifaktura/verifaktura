# Objavljivanje

Sva četiri paketa idu na npm u lockstepu, iz GitHub Actions.

## Nova verzija

GitHub → Actions → **Release** → Run workflow → `patch`, `minor` ili `major`.

Pipeline: `npm ci` → typecheck → testovi → priprema artefakata → build → e2e →
round-trip → podizanje verzije → objava → push commita i taga.

Verzija se diže tek nakon što prođu sve provjere, a commit i tag idu na remote
tek nakon uspješne objave. Neuspjeh zato ne ostavlja potrošen broj verzije ni
prazan tag.

Opcija `dry_run` prođe sve provjere i preskoči objavu — korisno kad se mijenja
sam workflow.

Alternativno, push taga `v*` pokreće isti pipeline bez koraka verzionisanja.

## Autentifikacija

Objava koristi **npm trusted publishing (OIDC)** — bez tokena u secrets. Svaki
publish dobija kratkotrajni, workflow-specifičan kredencijal i automatski
provenance potpis.

Podešava se po paketu: npmjs.com → *paket* → Settings → **Trusted Publisher** →
GitHub Actions:

| Polje | Vrijednost |
|---|---|
| Organization or user | `verifaktura` |
| Repository | `verifaktura` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

Sva polja su osjetljiva na velika i mala slova. npm ih ne provjerava pri
spremanju — greška se vidi tek pri objavi, kao `ENEEDAUTH`.

Ako je u repo secrets postavljen `NPM_TOKEN`, workflow će koristiti njega
umjesto OIDC-a. To postoji samo za prvu objavu paketa koji još ne postoji na
npm-u; poslije toga secret treba obrisati i token opozvati.

## Zahtjevi

- Repozitorij mora biti **public** — provenance se ne generiše iz privatnih.
- Node ≥ 22.14 i npm ≥ 11.5.1 (workflow koristi Node 24).
- Samo GitHub-hosted runneri; self-hosted ne podržavaju OIDC.
- `repository.url` u `package.json` mora tačno odgovarati GitHub repou.

## Verzionisanje

`scripts/version.mjs` postavlja istu verziju na sve pakete i usklađuje interne
raspone zavisnosti (`@verifaktura/cli` → `verifaktura: ^x.y.z`).
`npm version --workspaces` to ne radi pouzdano, zato zaseban skript.
