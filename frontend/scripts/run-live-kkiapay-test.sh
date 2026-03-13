#!/usr/bin/env bash
# Run live KkiaPay E2E tests (Playwright) against real TKH Payments + KkiaPay sandbox.
# Requires: PAYMENTS_SERVICE_URL, NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD.
# Backend and frontend must be running (or use staging URLs).
#
# Usage: ./scripts/run-live-kkiapay-test.sh
# Or:    cd frontend && npm run test:kkiapay:live  (after setting env vars)

set -e

cd "$(dirname "$0")/.."

missing=()
[[ -z "${PAYMENTS_SERVICE_URL}" ]] && missing+=("PAYMENTS_SERVICE_URL")
[[ -z "${NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY}" ]] && missing+=("NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY")
[[ -z "${E2E_TEST_EMAIL}" ]] && missing+=("E2E_TEST_EMAIL")
[[ -z "${E2E_TEST_PASSWORD}" ]] && missing+=("E2E_TEST_PASSWORD")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Error: Missing required env vars: ${missing[*]}"
  echo ""
  echo "Set them before running:"
  echo "  export PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1"
  echo "  export NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=your-kkiapay-sandbox-public-key"
  echo "  export E2E_TEST_EMAIL=your-test-user@example.com"
  echo "  export E2E_TEST_PASSWORD=your-password"
  echo ""
  echo "Ensure NEXT_PUBLIC_KKIAPAY_SANDBOX=true for sandbox testing."
  echo "See backend/docs/KKIAPAY_LIVE_TEST.md for details."
  exit 1
fi

echo "=== Running live KkiaPay E2E tests ==="
echo "  PAYMENTS_SERVICE_URL=$PAYMENTS_SERVICE_URL"
echo "  NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=${NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY:0:12}..."
echo "  E2E_TEST_EMAIL=$E2E_TEST_EMAIL"
echo ""

npm run test:kkiapay:live
