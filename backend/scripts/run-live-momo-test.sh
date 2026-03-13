#!/usr/bin/env bash
# Run live MoMo E2E tests against real TKH Payments + MTN MoMo sandbox.
# Requires: PAYMENTS_SERVICE_URL, MOMO_E2E_TOKEN (share token from a real invoice pay URL).
# Optional: MOMO_E2E_PHONE (defaults to +233241234567).
#
# Usage: ./scripts/run-live-momo-test.sh
# Or:    cd backend && npm run test:momo:live  (after setting env vars)

set -e

cd "$(dirname "$0")/.."

missing=()
[[ -z "${PAYMENTS_SERVICE_URL}" ]] && missing+=("PAYMENTS_SERVICE_URL")
[[ -z "${MOMO_E2E_TOKEN}" ]] && missing+=("MOMO_E2E_TOKEN")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: Missing required env vars: ${missing[*]}"
  echo ""
  echo "Set them before running:"
  echo "  export PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1"
  echo "  export MOMO_E2E_TOKEN=your-share-token-from-pay-url"
  echo "  export MOMO_E2E_PHONE=+233241234567   # optional, defaults to Ghana sandbox"
  echo ""
  echo "See backend/docs/MOMO_LIVE_TEST.md for details."
  exit 1
fi

echo "=== Running live MoMo E2E tests ==="
echo "  PAYMENTS_SERVICE_URL=$PAYMENTS_SERVICE_URL"
echo "  MOMO_E2E_TOKEN=${MOMO_E2E_TOKEN:0:8}..."
echo "  MOMO_E2E_PHONE=${MOMO_E2E_PHONE:-+233241234567}"
echo ""

MOMO_E2E_LIVE=1 npm run test:momo:live
