#!/usr/bin/env bash
# Ručna objava sva četiri paketa pomoću npm tokena.
#
# Koristi se SAMO za prvu (bootstrap) objavu — poslije nje se podesi trusted
# publishing i objava ide iz GitHub Actions bez ikakvog tokena (RELEASING.md).
#
#   ./scripts/publish-local.sh            # objavi tokenom
#   ./scripts/publish-local.sh --dry-run  # samo pokaži šta bi otišlo
#   ./scripts/publish-local.sh --otp      # koristi postojeći `npm login`, pita za 2FA kod
#
# Token se unosi interaktivno (ne vidi se, ne ulazi u shell historiju) i piše se
# u privremeni npmrc koji se briše na izlazu — ~/.npmrc ostaje netaknut.
#
# Ako nalog traži 2FA za objavu, granular token MORA imati uključen
# "Bypass two-factor authentication" — inače npm vraća E403 s porukom o 2FA.
# Token mora pokrivati i unscoped paket `verifaktura`, a on nije u scope-u
# @verifaktura: koristi opseg "All packages".

set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=""
USE_OTP=""
case "${1:-}" in
  --dry-run) DRY_RUN="--dry-run" ;;
  --otp)     USE_OTP="1" ;;
  "")        ;;
  *)         echo "Nepoznata opcija: $1"; exit 2 ;;
esac

PACKAGES=(packages/core packages/build packages/cius-hr packages/cli)

echo "Provjere prije objave..."
npm ci
npm run typecheck
npm test
npm run prepare:sef
npm run build
node scripts/e2e.mjs
node scripts/roundtrip.mjs

if [[ -z "$USE_OTP" ]]; then
  echo
  read -rsp "npm token (unos se ne prikazuje): " NPM_TOKEN
  echo
  [[ -z "$NPM_TOKEN" ]] && { echo "Prazan token, prekidam."; exit 2; }

  NPMRC="$(mktemp)"
  chmod 600 "$NPMRC"
  cleanup() { rm -f "$NPMRC"; }
  trap cleanup EXIT

  printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$NPMRC"
  unset NPM_TOKEN
  export NPM_CONFIG_USERCONFIG="$NPMRC"
fi

echo
echo "Prijavljen kao: $(npm whoami)"
echo

for dir in "${PACKAGES[@]}"; do
  name="$(node -p "require('./$dir/package.json').name")"
  echo "--- $name"
  OTP_ARG=()
  if [[ -n "$USE_OTP" ]]; then
    # Kod vrijedi ~30 s, pa se traži svjež za svaki paket.
    read -rp "2FA kod za $name: " OTP
    OTP_ARG=(--otp "$OTP")
  fi
  (cd "$dir" && npm publish $DRY_RUN "${OTP_ARG[@]}")
done

echo
if [[ -n "$DRY_RUN" ]]; then
  echo "Probni prolaz — ništa nije objavljeno."
else
  echo "Objavljeno. Sljedeći korak: podesi trusted publishing za svaki paket"
  echo "(npmjs.com -> paket -> Settings -> Trusted Publisher), pa ovaj skript"
  echo "više ne treba — release ide iz GitHub Actions."
fi
