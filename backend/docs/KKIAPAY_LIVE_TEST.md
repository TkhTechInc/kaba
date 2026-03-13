# KkiaPay Live E2E Tests

Live E2E tests hit **real TKH Payments** and **KkiaPay sandbox** to verify the widget payment flow end-to-end. KkiaPay is the primary payment method for West Africa (XOF, XAF, GNF). Use these when you need to validate against actual services (e.g. nightly, before release, after TKH Payments changes).

## When to Use

| Mode | Use case |
|------|----------|
| **Mocked** (default) | CI, local dev, fast feedback. Uses nock to mock TKH Payments. |
| **Live** | Nightly validation, pre-release checks, debugging TKH Payments + KkiaPay integration. |

## Prerequisites

1. **TKH Payments** running with KkiaPay configured (gateway credentials in TKH Payments).
2. **KkiaPay sandbox** – Use sandbox API keys from [KkiaPay dashboard](https://app.kkiapay.me).
3. **Business in KkiaPay country** – XOF invoice; business country BJ, TG, CI, SN, etc. (see `PaymentGatewayManager.ts`).
4. **Backend + frontend running** – Or use deployed staging URLs for CI.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `PAYMENTS_SERVICE_URL` | TKH Payments base URL (e.g. `https://payments.example.com/api/v1`) |
| `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` | KkiaPay sandbox public key from app.kkiapay.me |
| `E2E_TEST_EMAIL` | Test user email for login |
| `E2E_TEST_PASSWORD` | Test user password |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_KKIAPAY_SANDBOX` | Use KkiaPay sandbox | `true` for dev |
| `PLAYWRIGHT_BASE_URL` | Frontend URL for Playwright | `http://localhost:3000` |

## Test Phone Numbers (KkiaPay Sandbox)

From [KkiaPay sandbox docs](https://docs.kkiapay.me/v1/en-1.0.0/compte/kkiapay-sandbox-guide-de-test):

| Phone | Scenario |
|-------|----------|
| `61000000` | Successful (MTN Benin) |
| `68000000` | Successful (MOOV) |
| `61000001` | Processing error |
| `61000002` | Insufficient fund |
| `61000003` | Payment declined |

The E2E test uses `61000000` for a successful flow.

## How to Run

### Option 1: Shell script (recommended)

```bash
cd frontend

export PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1
export NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=your-kkiapay-sandbox-public-key
export E2E_TEST_EMAIL=your-test-user@example.com
export E2E_TEST_PASSWORD=your-password

./scripts/run-live-kkiapay-test.sh
```

Ensure backend is running (`cd backend && npm run dev`) and frontend (`npm run dev`).

### Option 2: npm script

```bash
cd frontend

export PAYMENTS_SERVICE_URL=...
export NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=...
export E2E_TEST_EMAIL=...
export E2E_TEST_PASSWORD=...

npm run test:kkiapay:live
```

### Option 3: Against staging

```bash
cd frontend

export PLAYWRIGHT_BASE_URL=https://app-dev.example.com
export NEXT_PUBLIC_API_URL=https://api-dev.example.com
export PAYMENTS_SERVICE_URL=...
export NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=...
export E2E_TEST_EMAIL=...
export E2E_TEST_PASSWORD=...

npm run test:kkiapay:live
```

## Live Test Behavior

The test creates a customer and XOF invoice, shares it, opens the pay page, clicks "Pay with KkiaPay", enters the sandbox test phone `61000000` in the widget, and asserts the redirect to the success page. No manual approval is needed—the sandbox simulates success immediately.

## Running in CI (Nightly)

The workflow `.github/workflows/nightly-kkiapay.yml` runs daily at 2am UTC and on manual `workflow_dispatch`.

**Configure repo secrets:**

| Secret | Description |
|--------|-------------|
| `E2E_TEST_EMAIL` | Test user email |
| `E2E_TEST_PASSWORD` | Test user password |
| `PAYMENTS_SERVICE_URL` | TKH Payments URL |
| `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` | KkiaPay sandbox public key |
| `PLAYWRIGHT_BASE_URL` | Deployed dev/staging frontend URL |
| `NEXT_PUBLIC_API_URL` | Deployed dev/staging API URL |

The test runs against the deployed staging environment. Ensure the test user exists and the business supports KkiaPay (XOF, country BJ/TG/CI/etc.).

## MoMo Tests

For MoMo (RequestToPay) live tests, see [MOMO_LIVE_TEST.md](./MOMO_LIVE_TEST.md).
