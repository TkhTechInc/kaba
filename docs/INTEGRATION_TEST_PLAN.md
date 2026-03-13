# Kaba — Integration Test Plan

Integration tests run against the **real API** (localhost:3001 or configurable). They verify end-to-end flows and document responses from each service.

**See [INTEGRATION_TEST_STATUS.md](./INTEGRATION_TEST_STATUS.md)** for: happy paths, failure paths, gaps, and what to fix.

## Prerequisites

1. **Backend running**: `cd backend && npm run dev`
2. **Test credentials** (set in `.env` or environment):
   - `INTEGRATION_TEST_EMAIL` — email for test user
   - `INTEGRATION_TEST_PASSWORD` — password for test user
   - Or `INTEGRATION_TEST_TOKEN` — JWT if you have one
3. **Optional**: `INTEGRATION_TEST_API_URL` (default: `http://localhost:3001`)

## Run Integration Tests

1. Start the backend: `cd backend && npm run dev`
2. In another terminal:

```bash
cd backend
INTEGRATION_TEST_EMAIL=test@example.com INTEGRATION_TEST_PASSWORD=secret \
  npm run test:integration
```

Or with token (e.g. from browser localStorage `qb_auth_token`):

```bash
INTEGRATION_TEST_TOKEN=eyJ... INTEGRATION_TEST_API_URL=http://localhost:3001 \
  npm run test:integration
```

Without credentials, only Health, Storefront (public), and Unauthenticated tests run.

**Note:** `test:integration` also runs PaymentsClient.integration (mocked) and MoMo.e2e (mocked). To run only API tests against the real backend: `jest --testPathPattern=api.integration --no-coverage`

---

## Pages & Scenarios

### 1. Auth

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Sign in | `POST /api/v1/auth/login/email` | Valid email + password | 200, `{ token, user }` |
| Sign in | `POST /api/v1/auth/login/email` | Invalid credentials | 401 |
| Sign up | `POST /api/v1/auth/sign-up` | New user | 201, `{ token, user }` |
| Forgot password | `POST /api/v1/auth/forgot-password` | Valid email | 200 |

### 2. Dashboard (Home)

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Dashboard | `GET /api/v1/dashboard/summary?businessId=` | Authenticated | 200, summary data |
| Dashboard | `GET /api/v1/dashboard/payments-overview?businessId=` | Authenticated | 200 |
| Dashboard | `GET /api/v1/dashboard/weeks-profit?businessId=` | Authenticated | 200 |
| Dashboard | `GET /api/v1/dashboard/activity-by-type?businessId=` | Authenticated | 200 |
| Mobile home | `GET /api/v1/mobile/home?businessId=` | Authenticated | 200 |

### 3. Access / Businesses

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Businesses | `GET /api/v1/access/businesses` | Authenticated | 200, list of businesses |
| Organizations | `GET /api/v1/access/organizations` | Authenticated | 200, list of orgs |

### 4. Invoices

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List invoices | `GET /api/v1/invoices?businessId=&page=1&limit=20` | Authenticated | 200, `{ items, total }` |
| Get invoice | `GET /api/v1/invoices/:id?businessId=` | Authenticated | 200, invoice |
| Create invoice | `POST /api/v1/invoices` | Valid payload | 201, invoice |
| Share invoice | `POST /api/v1/invoices/:id/share` | Authenticated | 200, `{ token, shareUrl }` |
| Pay (public) | `GET /api/v1/invoices/pay/:token` | Valid token | 200, invoice + pay config |

### 5. Customers

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List customers | `GET /api/v1/customers?businessId=&page=1&limit=20` | Authenticated | 200 |
| Create customer | `POST /api/v1/customers` | Valid payload | 201 |
| Portal lookup | `GET /api/v1/customers/portal/lookup?businessId=&email=` | Public | 200 or 404 |
| Portal invoices | `GET /api/v1/customers/portal/invoices?businessId=&customerId=` | Public | 200 |

### 6. Ledger

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List entries | `GET /api/v1/ledger/entries?businessId=&fromDate=&toDate=` | Authenticated | 200 |
| Create entry | `POST /api/v1/ledger/entries` | Valid payload | 201 |
| Balance | `GET /api/v1/ledger/balance?businessId=&asOfDate=` | Authenticated | 200 |
| Locked periods | `GET /api/v1/ledger/locked-periods?businessId=` | Authenticated | 200 |
| Lock period | `POST /api/v1/ledger/lock-period` | Owner | 200 |

### 7. Products & Inventory

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List products | `GET /api/v1/products?businessId=` | Authenticated | 200 |
| Create product | `POST /api/v1/products` | Valid payload | 201 |
| Get product | `GET /api/v1/products/:id?businessId=` | Authenticated | 200 |

### 8. Debts

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List debts | `GET /api/v1/debts?businessId=` | Authenticated (pro tier) | 200 or 403 |
| Create debt | `POST /api/v1/debts` | Valid payload | 201 |

### 9. Suppliers

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List suppliers | `GET /api/v1/suppliers?businessId=` | Authenticated | 200 |
| Create supplier | `POST /api/v1/suppliers?businessId=` | Valid payload | 201 |

### 10. Reports

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| P&L | `GET /api/v1/reports/pl?businessId=&fromDate=&toDate=` | Authenticated | 200 |
| Cash flow | `GET /api/v1/reports/cash-flow?businessId=&fromDate=&toDate=` | Authenticated | 200 |
| Consolidated | `GET /api/v1/reports/consolidated?organizationId=&fromDate=&toDate=` | Org member | 200 |

### 11. Reconciliation

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Mobile money | `POST /api/v1/reconciliation/mobile-money` | Valid payload (pro tier) | 200 or 403 |

### 12. Receipts

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Upload URL | `GET /api/v1/receipts/upload-url?businessId=&contentType=` | Authenticated | 200, `{ uploadUrl, key }` |
| Process | `POST /api/v1/receipts/process` | Valid key | 200 |

### 13. Trust

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| My score | `GET /api/v1/trust/my-score?businessId=` | Authenticated | 200 |
| Share | `POST /api/v1/trust/share` | Authenticated | 200, `{ shareUrl }` |

### 14. Branches / Organizations

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| List orgs | `GET /api/v1/org` | Authenticated | 200 |
| Create org | `POST /api/v1/org` | Owner, `{ name, businessId }` | 200 |
| List branches | `GET /api/v1/org/:orgId/branches` | Org member | 200 |
| Create branch | `POST /api/v1/org/branches` | Owner, `{ organizationId, name, parentBusinessId }` | 200 |

### 15. Storefront (Public)

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Get storefront | `GET /api/v1/storefront/:slug` | Valid slug | 200, business profile |
| Initiate pay | `POST /api/v1/storefront/:slug/pay` | Valid amount | 200, checkout data |

### 16. Onboarding

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Get progress | `GET /api/v1/onboarding?businessId=` | Authenticated | 200 |
| Patch | `PATCH /api/v1/onboarding?businessId=` | Authenticated | 200 |

### 17. Settings

| Page | Endpoint | Scenario | Expected |
|------|----------|----------|----------|
| Team members | `GET /api/v1/access/businesses/:businessId/members` | members:manage | 200 |
| API keys | `GET /api/v1/api-keys?businessId=` | Authenticated | 200 |
| Webhooks | `GET /api/v1/webhooks?businessId=` | Authenticated | 200 |
| Plans | `GET /api/v1/plans` | Authenticated | 200 |

---

## Test Output

Each test logs:
- **Endpoint** and method
- **Status code** and response shape
- **Pass / Fail** with reason

Failed tests indicate which services need attention (config, permissions, or implementation).
