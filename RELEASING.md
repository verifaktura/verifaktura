# Releasing

All four packages are published to npm in lockstep, from GitHub Actions.

## New version

GitHub → Actions → **Release** → Run workflow → `patch`, `minor` or `major`.

Pipeline: `npm ci` → typecheck → tests → prepare artefacts → build → e2e →
round-trip → version bump → publish → push commit and tag.

The version is bumped only after every check passes, and the commit and tag are
pushed only after a successful publish. A failure therefore leaves neither a
burnt version number nor a dangling tag.

`dry_run` runs all checks and skips publishing — useful when changing the
workflow itself.

Pushing a `v*` tag runs the same pipeline without the versioning step.

## Authentication

Publishing uses **npm trusted publishing (OIDC)** — no token in secrets. Each
publish gets a short-lived, workflow-specific credential and an automatic
provenance attestation.

Configured per package: npmjs.com → *package* → Settings → **Trusted Publisher**
→ GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `verifaktura` |
| Repository | `verifaktura` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

All fields are case-sensitive. npm does not validate them on save — a mistake
only surfaces at publish time as `ENEEDAUTH`.

If an `NPM_TOKEN` repository secret exists, the workflow uses it instead of
OIDC. That path exists only to bootstrap a package that does not yet exist on
npm; afterwards, delete the secret and revoke the token.

## Requirements

- The repository must be **public** — provenance is not generated from private ones.
- Node ≥ 22.14 and npm ≥ 11.5.1 (the workflow uses Node 24).
- GitHub-hosted runners only; self-hosted runners do not support OIDC.
- `repository.url` in `package.json` must exactly match the GitHub repository.

## Versioning

`scripts/version.mjs` sets the same version across all packages and aligns
internal dependency ranges (`@verifaktura/cli` → `verifaktura: ^x.y.z`).
`npm version --workspaces` does not do this reliably, hence the separate script.
