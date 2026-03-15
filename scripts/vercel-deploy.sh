#!/bin/bash
# Deploy Kaba frontend to Vercel via CLI
# Usage: ./scripts/vercel-deploy.sh [preview|production]
# Requires: npx vercel (or npm i -g vercel), logged in via vercel login

set -e
cd "$(dirname "$0")/../frontend"

ENV="${1:-preview}"

echo "Deploying Kaba frontend to Vercel ($ENV)..."

# Link project if not already linked
if [[ ! -d .vercel ]]; then
  echo "Linking project (first-time setup)..."
  npx vercel link --yes
fi

# Deploy
if [[ "$ENV" == "production" ]]; then
  npx vercel deploy --prod
else
  npx vercel deploy
fi

echo "Done. Run 'npx vercel' in frontend/ to open dashboard."
