# Integration Test Status

What "passed" means: the test ran against the real API and the assertion matched the actual response. This doc lists happy paths, failure paths, and what still needs fixing.

---

## Happy Path (what we test for success)

When credentials are set (`INTEGRATION_TEST_EMAIL` + `INTEGRATION_TEST_PASSWORD` or `INTEGRATION_TEST_TOKEN`), these pass:

| Endpoint | Method | Assertion |
|----------|--------|-----------|
| `/health` | GET | 200, `status: 'ok'`, `message` contains "running" |
| `/api/v1/access/businesses` | GET | 200, `data` is array |
| `/api/v1/access/organizations` | GET | 200 |
| `/api/v1/dashboard/summary` | GET | 200, `data` defined |
| `/api/v1/dashboard/payments-overview` | GET | 200 |
| `/api/v1/dashboard/weeks-profit` | GET | 200 |
| `/api/v1/mobile/home` | GET | 200 |
| `/api/v1/invoices` | GET | 200, `data.items` is array |
| `/api/v1/customers` | GET | 200, `data.items` is array |
| `/api/v1/ledger/entries` | GET | 200, `data.items` is array |
| `/api/v1/ledger/balance` | GET | 200 |
| `/api/v1/products` | GET | 200, `data` or `data.items` is array |
| `/api/v1/reports/pl` | GET | 200 |
| `/api/v1/reports/cash-flow` | GET | 200 |
| `/api/v1/onboarding` | GET | 200, `data` defined |
| `/api/v1/org` | GET | 200, `data` is array |

---

## Failure Path (what we test when things go wrong)

| Scenario | Endpoint | Expected |
|----------|----------|----------|
| Unknown storefront slug | `GET /api/v1/storefront/nonexistent-slug-xyz` | 404, error body |
| No auth token | `GET /api/v1/dashboard/summary?businessId=biz-any` | 401, `statusCode: 401` |

---

## Not Yet Tested (gaps from INTEGRATION_TEST_PLAN.md)

| Scenario | Endpoint | Notes |
|----------|----------|-------|
| Invalid login | `POST /api/v1/auth/login/email` bad creds | Expect 401 |
| Sign up | `POST /api/v1/auth/sign-up` | Expect 201 |
| Forgot password | `POST /api/v1/auth/forgot-password` | Expect 200 |
| Get invoice by id | `GET /api/v1/invoices/:id` | Expect 200 or 404 |
| Create invoice | `POST /api/v1/invoices` | Expect 201 |
| Share invoice | `POST /api/v1/invoices/:id/share` | Expect 200 |
| Create customer | `POST /api/v1/customers` | Expect 201 |
| Create ledger entry | `POST /api/v1/ledger/entries` | Expect 201 |
| Create product | `POST /api/v1/products` | Expect 201 |
| Debts list | `GET /api/v1/debts` | Expect 200 or 403 |
| Suppliers list | `GET /api/v1/suppliers` | Expect 200 |
| Receipts upload URL | `GET /api/v1/receipts/upload-url` | Expect 200 |
| Trust my-score | `GET /api/v1/trust/my-score` | Expect 200 |
| Trust share | `POST /api/v1/trust/share` | Expect 200 |
| Storefront valid slug | `GET /api/v1/storefront/:slug` | Expect 200 |
| Storefront pay | `POST /api/v1/storefront/:slug/pay` | Expect 200 |
| Customer portal lookup | `GET /api/v1/customers/portal/lookup` | Expect 200 or 404 |
| Create org | `POST /api/v1/org` | Expect 200 |
| Create branch | `POST /api/v1/org/branches` | Expect 200 |
| 403 for wrong business | Protected endpoint with `businessId` user can't access | Expect 403 |

---

## What to Fix (currently failing)

None. PaymentsClient and MoMo tests were fixed by clearing `MOMO_TEST_CURRENCY` and `MOMO_TEST_COUNTRY` in test `beforeAll` so the mocked nock response is used as-is.

---

## How to Run

```bash
# All integration tests (API + PaymentsClient + MoMo)
INTEGRATION_TEST_EMAIL=you@example.com INTEGRATION_TEST_PASSWORD=secret npm run test:integration

# API only (real backend)
npx jest --testPathPattern='api\.integration' --no-coverage

# Payments + MoMo only (mocked)
npm run test:payments
```

---

## Prerequisites

- Backend running: `npm run dev` (localhost:3001)
- Test user with password (OAuth-only users: run `npm run set-user-password`)
- User must have at least one business (run `npm run fix-dev` if needed)
