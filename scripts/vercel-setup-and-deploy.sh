#!/bin/bash
# Vercel CLI deploy. Run: npx vercel login  (first time, in your terminal)
# Then: ./scripts/vercel-setup-and-deploy.sh [preview|production]

set -e
cd "$(dirname "$0")/../frontend"

ENV="${1:-preview}"

if ! npx vercel whoami &>/dev/null; then
  echo "Not logged in. Run: npx vercel login"
  exit 1
fi

[[ ! -d .vercel ]] && npx vercel link --yes

if [[ "$ENV" == "production" ]]; then
  npx vercel deploy --prod
else
  npx vercel deploy
fi
