# MoMo Live E2E Tests

Live E2E tests hit **real TKH Payments** and **MTN MoMo sandbox** to verify the RequestToPay flow end-to-end. Use these when you need to validate against actual services (e.g. before release, after TKH Payments changes).

## When to Use

| Mode | Use case |
|------|----------|
| **Mocked** (default) | CI, local dev, fast feedback. Uses nock to mock TKH Payments. |
| **Live** | Pre-release validation, debugging TKH Payments integration, verifying MoMo sandbox. |

## Prerequisites

1. **TKH Payments** running with MoMo configured (gateway credentials in TKH Payments).
2. **Valid share token** – Create an invoice, share it, copy the token from the pay URL (e.g. `/pay/abc-123-token` → token is `abc-123-token`).
3. **MTN MoMo sandbox** – Use [MTN MoMo sandbox test numbers](https://momodeveloper.mtn.com/) for the payer phone.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `PAYMENTS_SERVICE_URL` | TKH Payments base URL (e.g. `https://payments.example.com/api/v1`) |
| `MOMO_E2E_TOKEN` | Share token from a real invoice pay URL |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `MOMO_E2E_PHONE` | Payer phone for RequestToPay | `+233241234567` (Ghana sandbox) |

## How to Run

### Option 1: Shell script (recommended)

```bash
cd backend

export PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1
export MOMO_E2E_TOKEN=your-token-from-pay-url

./scripts/run-live-momo-test.sh
```

The script checks required env vars and runs the live tests.

### Option 2: npm script

```bash
cd backend

export PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1
export MOMO_E2E_TOKEN=your-token-from-pay-url

npm run test:momo:live
```

### Option 3: Inline

```bash
MOMO_E2E_LIVE=1 MOMO_E2E_TOKEN=xxx MOMO_E2E_PHONE=+233241234567 \
  PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1 \
  npm run test:momo:live
```

## Live Test Behavior

The live test sends a real RequestToPay to the MTN MoMo sandbox. **You must approve the payment** on the MTN sandbox simulator (or test device) within the test timeout (~15s) for the test to pass.

## Running in CI (e.g. Nightly)

To run live MoMo tests in CI (e.g. GitHub Actions nightly):

1. Add repo secrets: `PAYMENTS_SERVICE_URL`, `MOMO_E2E_TOKEN` (and optionally `MOMO_E2E_PHONE`).
2. Create a workflow that runs on `schedule` (e.g. `cron: '0 2 * * *'` for 2am UTC) or on manual `workflow_dispatch`.
3. Run: `cd backend && ./scripts/run-live-momo-test.sh` with secrets exposed as env vars.

**Note:** The share token expires when the invoice share link expires. For nightly runs, use a long-lived test invoice or rotate the token periodically.
