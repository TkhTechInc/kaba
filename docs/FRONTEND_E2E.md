# Frontend E2E Tests (Playwright)

E2E tests verify the frontend displays and behaves correctly in a real browser.

## Prerequisites

1. **Backend running**: `cd backend && npm run dev` (localhost:3001)
2. **Frontend**: Playwright starts it via `webServer` or run `npm run dev` (localhost:3000)
3. **Credentials** (for auth tests): `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
4. **Full journey coverage** (optional): Run `SEED_EMAIL=your@email.com npm run fix-dev` in `backend/` to upgrade the test user's business to pro tier. Otherwise, journey tests skip when features (invoicing, inventory, debt) are not on the plan.

## Run E2E Tests

```bash
cd frontend

# All tests (starts frontend if not running)
npm run test:e2e

# With credentials for auth-dependent tests
E2E_TEST_EMAIL=lloydharold14@gmail.com E2E_TEST_PASSWORD='Campus2020$' npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Single file
npx playwright test e2e/auth.spec.ts
```

## Test Files

| File | Coverage |
|------|----------|
| `e2e/auth.setup.ts` | Logs in once and saves auth state (reduces rate-limit impact) |
| `e2e/auth.spec.ts` | Sign-in page load, invalid login error, login redirect |
| `e2e/dashboard.spec.ts` | Dashboard overview, invoices, customers, products (uses saved auth) |
| `e2e/journeys.spec.ts` | User journeys: customer, invoice, product, debt create→list flows (skips if feature not on plan) |
| `e2e/payment-cash-flow.spec.ts` | Cash payment flow: create invoice → POS page → "Collected cash" → payment confirmed (no TKH Payments required) |
| `e2e/kkiapay-payment.spec.ts` | KkiaPay widget flow: XOF invoice → pay page → KkiaPay sandbox → payment confirmed (requires TKH Payments + KkiaPay) |
| `e2e/public.spec.ts` | Sign-in, sign-up, forgot-password, store 404 |

## Config

- `playwright.config.ts` — baseURL: `http://localhost:3000` (or `PLAYWRIGHT_BASE_URL`)
- `webServer` — runs `npm run dev` if no server on baseURL
- Browsers: Chromium only (add Firefox/WebKit in config if needed)
- **Auth setup**: Runs first, saves state to `playwright/.auth/user.json`; dashboard tests reuse it

## Cash Payment Flow

`e2e/payment-cash-flow.spec.ts` covers the POS cash payment path that **bypasses the real payment gateway**:

1. Creates a customer and invoice via UI
2. Navigates to `/invoices/[id]/pos`
3. Clicks "Collected cash" (or French equivalent)
4. Asserts "Payment confirmed" is shown
5. Optionally verifies invoice status is "paid" on the invoices list

This test works **without TKH Payments** — it uses the cash-only path (`mark-paid` API).

## KkiaPay Payment Flow

`e2e/kkiapay-payment.spec.ts` covers the **KkiaPay widget** flow (primary payment method via TKH Payments):

1. Creates a customer and XOF invoice via UI
2. Shares invoice and opens pay page
3. Clicks "Pay with KkiaPay" → widget opens
4. Enters sandbox test phone `61000000` (MTN Benin success)
5. Asserts redirect to success page and "Payment confirmed"

Requires: `PAYMENTS_SERVICE_URL`, `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`. See [backend/docs/KKIAPAY_LIVE_TEST.md](../backend/docs/KKIAPAY_LIVE_TEST.md).

## Install Browsers

```bash
npx playwright install
# Or just Chromium:
npx playwright install chromium
```
