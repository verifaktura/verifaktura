#!/usr/bin/env bash
# Ručna objava sva četiri paketa pomoću npm tokena.
#
# Koristi se SAMO za prvu (bootstrap) objavu — poslije nje se podesi trusted
# publishing i objava ide iz GitHub Actions bez ikakvog tokena (RELEASING.md).
#
#   ./scripts/publish-local.sh            # objavi
#   ./scripts/publish-local.sh --dry-run  # samo pokaži šta bi otišlo
#
# Token se unosi interaktivno (ne vidi se, ne ulazi u shell historiju) i piše se
# u privremeni npmrc koji se briše na izlazu — ~/.npmrc ostaje netaknut.

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=""
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN="--dry-run"

PACKAGES=(packages/core packages/build packages/cius-hr packages/cli)

echo "Provjere prije objave..."
npm ci
npm run typecheck
npm test
npm run prepare:sef
npm run build
node scripts/e2e.mjs
node scripts/roundtrip.mjs

echo
read -rsp "npm token (unos se ne prikazuje): " NPM_TOKEN
echo
[[ -z "$NPM_TOKEN" ]] && { echo "Prazan token, prekidam."; exit 2; }

NPMRC="$(mktemp)"
chmod 600 "$NPMRC"
cleanup() { rm -f "$NPMRC"; unset NPM_TOKEN; }
trap cleanup EXIT

printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$NPMRC"
unset NPM_TOKEN

export NPM_CONFIG_USERCONFIG="$NPMRC"

echo
echo "Prijavljen kao: $(npm whoami)"
echo

for dir in "${PACKAGES[@]}"; do
  name="$(node -p "require('./$dir/package.json').name")"
  echo "--- $name"
  (cd "$dir" && npm publish $DRY_RUN)
done

echo
if [[ -n "$DRY_RUN" ]]; then
  echo "Probni prolaz — ništa nije objavljeno."
else
  echo "Objavljeno. Sljedeći korak: podesi trusted publishing za svaki paket"
  echo "(npmjs.com -> paket -> Settings -> Trusted Publisher), pa ovaj skript"
  echo "više ne treba — release ide iz GitHub Actions."
fi
