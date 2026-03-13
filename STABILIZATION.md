# Kaba — Stabilization Status

**Goal:** Freeze feature development and ensure the project builds, runs, and is ready for testing/deployment.

---

## Completed

| Item | Status |
|------|--------|
| Backend TypeScript build | ✅ Passes |
| Backend type-check | ✅ Passes |
| Backend ESLint | ✅ 0 errors, 62 warnings |
| Frontend TypeScript build | ✅ Passes |
| Frontend lint | ✅ Passes |
| Stripe package | ✅ Installed (`stripe`) |
| `LedgerRepository.listAllByBusinessForBalance` | ✅ Returns `category` and `currency` for AI/reports |
| Payment routing | ✅ Country-based (not currency) |
| TKH Payments microservice integration | ✅ `PaymentsClient` replaces local gateway manager |
| KkiaPay JS widget | ✅ Supported on `/pay/[token]` public page |
| SNS payment event handler | ✅ Lambda subscribes to `tkhtech-payment-events-dev`, marks invoices paid, creates ledger entries |
| CDK — dev environment | ✅ Deployed to `ca-central-1` (Kaba AWS account `110044886269`) |
| CI/CD (GitHub Actions) | ✅ `ci.yml` on PRs (lint, type-check, `npm test` runs Jest), `deploy.yml` on `main` push / tag |
| Global search | ✅ `GlobalSearch.tsx`, `use-global-search.ts`, `date-range-filter.tsx` |
| Backend Jest suite | ✅ 24 spec files — **255 passed, 0 failed** (31 skipped: AI integration tests need funded OpenRouter account) |
| MECeF / Benin e-invoicing | ✅ `BeninEmecefAdapter` aligned to DGI e-MCF API v1.0; sandbox-tested with real JWT + IFU |
| Invoice PDF modes | ✅ `invoice` (A4 unpaid), `receipt` (A4 paid), `thermal` (72mm roll) via `InvoicePdfService` |
| POS terminal | ✅ `/invoices/[id]/pos` — QR payment, cash payment button, A4/thermal receipt download |
| QR on all invoices | ✅ Any business with `taxId` (IFU/NCC) gets a QR on every invoice, independent of tier |
| Business Profile page | ✅ `/settings/profile` — editable name, address, phone, country, currency, tax regime, IFU, RCCM, legal status, slug |
| Onboarding — fiscal identity | ✅ Step 3 collects legalStatus, RCCM, tax regime, IFU/NCC with country-aware hints and contextual DGI guidance |
| Suppliers domain | ✅ `SupplierController`, `SupplierService`, `SupplierRepository`, pay-supplier flow |
| Storefront domain | ✅ Public storefront with payment flow at `/store/[slug]` |
| MCP agent tools | ✅ 20+ tools (business, customer, admin) via `McpController` |
| Mobile sync | ✅ `MobileController`, `MobileService`, offline-first sync endpoints |
| Debt tracker | ✅ `DebtService`, `DebtRepository` |
| Customer portal | ✅ `/portal/[businessId]` — public invoice lookup by email |
| Error / not-found pages | ✅ App-level `error.tsx`, `not-found.tsx`, auth error page |
| Playwright e2e setup | ✅ `auth.setup.ts` bug fixed (`bizRes.ok()` method call); test files exist |

---

## Scripts

```bash
# Backend
cd backend
npm run build
npm run type-check
npm run lint
npm test                      # Jest — 24 spec files, 255 passed
npm run dev

# Frontend
cd frontend
npm run build
npm run dev

# MECeF sandbox test (requires MECEF_BENIN_JWT + MECEF_TEST_IFU in .env)
cd backend
npm run mecef:sandbox-test
```

---

## Environment Variables

### Backend (Lambda — set in CDK / `.env` locally)

| Variable | Description |
|----------|-------------|
| `PAYMENTS_SERVICE_URL` | TKH Payments microservice base URL |
| `DYNAMODB_TABLE_NAME` | DynamoDB table for Kaba data |
| `JWT_SECRET` | JWT signing secret |
| `MECEF_BENIN_JWT` | Benin DGI e-MECeF API JWT (from impots.bj developer portal) |
| `MECEF_BENIN_BASE_URL` | `https://developper.impots.bj` (sandbox) or `https://emcf.impots.bj` (prod) |
| `MECEF_TEST_IFU` | IFU used in sandbox tests (e.g. `0202376693109`) |

### Frontend (Next.js — set in GitHub Secrets + `.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `https://api.kaba.dev`) |
| `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` | KkiaPay public key for the JS widget |
| `NEXT_PUBLIC_KKIAPAY_SANDBOX` | `"true"` for dev, `"false"` for prod |

---

## CDK Deploy

```bash
# Dev (auto via GitHub Actions on push to main)
cd backend && npm run cdk:deploy

# Staging / Prod with Payments config
cd backend
cdk deploy -c environment=staging \
  -c paymentsServiceUrl=https://PAYMENTS_API_URL/api/v1 \
  -c paymentsSnsTopicArn=arn:aws:sns:ca-central-1:497172038983:tkhtech-payment-events-staging \
  --all --require-approval never
```

---

## Known Limitations / Open Items

| Item | Notes |
|------|-------|
| **WhatsApp providers** | Only Meta Cloud API supported. Twilio and Africa's Talking providers are stub TODO. |
| **Staging/prod payments config** | `paymentsServiceUrl` and `paymentsSnsTopicArn` must be supplied via CDK context at deploy time — no hardcoded staging/prod URLs yet. |
| **KkiaPay webhook** | Payment webhook verification uses `KKIAPAY_PRIVATE_KEY` — must be set in Lambda environment for prod. |
| **Reconciliation** | Mobile money SMS parsing requires `MOBILE_MONEY_PARSER_PROVIDER=llm` and AI config for real parsing; mock returns empty. |
| **AI integration tests** | 31 tests skipped in CI: `AIProviders.integration` and `LocalLangBenchmark` require a funded OpenRouter account (`OPENROUTER_API_KEY`). |
| **MECeF status on invoice detail** | After MECeF registers async, invoice detail page doesn't auto-refresh to show DGI certification badge. Needs polling or refresh button. |
| **Playwright e2e** | Test files exist and auth setup is fixed. Have not been run clean against a dev server end-to-end. |

---

*Last updated: 2026-03-13 — MECeF, PDF modes, POS, business profile, fiscal onboarding, test fixes*
