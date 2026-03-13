# Kaba — QA & Dev Setup Guide

This guide covers prerequisites, environment setup, mock vs sandbox options, and how to run all test suites.

See also: [README.md](../README.md) for quick start, [STABILIZATION.md](../STABILIZATION.md) for feature status and env var reference.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20 LTS | Run `nvm use` (reads `.nvmrc`) |
| **npm** | bundled with Node | — |
| **AWS CLI** | v2 | `aws configure` with access to account `110044886269`, region `ca-central-1` |
| **Git** | — | For clone and version control |

### AWS credentials

```bash
aws configure
# AWS Access Key ID:     <your key>
# AWS Secret Access Key: <your secret>
# Default region:        ca-central-1
# Default output format: json
```

The backend uses DynamoDB, S3, SES, and SNS — all in `ca-central-1`. Your IAM user needs access to those services.

---

## Clone & Install

```bash
git clone <repo-url>
cd quickbooks
nvm use          # installs Node 20 from .nvmrc
```

### Backend

```bash
cd backend
cp .env.example .env   # or cp .env.qa.example .env for QA/dev mocks
# Edit .env — see "Backend .env" below
npm install
npm run dev             # → http://localhost:3001
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev             # → http://localhost:3000
```

---

## Backend .env Setup

### Minimum required (to start the server)

```bash
# Required
JWT_SECRET=any-long-random-string

# AWS (DynamoDB, SES, SNS, S3)
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# DynamoDB tables (ask team for dev table names, or deploy CDK first)
DYNAMODB_TABLE_NAME=Kaba-LedgerService-dev-ledger
# DYNAMODB_LEDGER_TABLE, DYNAMODB_INVOICES_TABLE, etc. — see .env.example

# Admin access (your phone/email)
ADMIN_PHONES=+1234567890
ADMIN_EMAILS=you@example.com

# URLs
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001
```

### Optional (for full features)

- **OAuth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- **AI**: `OPENROUTER_API_KEY` or other AI provider keys
- **TKH Payments**: `PAYMENTS_SERVICE_URL`, `TKH_PAYMENTS_API_KEY` — needed for payment links
- **SMS/Email/WhatsApp**: See "Mock vs Sandbox" below

For a cost-free QA/dev setup, use `backend/.env.qa.example` as a template:

```bash
cd backend
cp .env.qa.example .env
# Edit .env — add JWT_SECRET, AWS credentials, DynamoDB table names, admin contacts
```

It disables SMS/email, uses mocks for WhatsApp/reconciliation/receipt PDF, and sets `MOMO_TEST_MOCK_SUCCESS=true`.

---

## Frontend .env.local Setup

```bash
# Backend API base URL (no trailing slash)
NEXT_PUBLIC_API_URL=http://localhost:3001

# KkiaPay widget (optional — for payment links)
NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=
NEXT_PUBLIC_KKIAPAY_SANDBOX=true
```

---

## Mock vs Sandbox Options

| Service | Mock (cost-free) | Sandbox / Real |
|---------|------------------|----------------|
| **SMS** | `SMS_ENABLED=false` — OTP logged to backend console | `SMS_ENABLED=true` + AWS SNS / Twilio / Africa's Talking credentials |
| **Email** | `EMAIL_ENABLED=false` — reset links/codes logged to console | `EMAIL_ENABLED=true` + AWS SES (sender verified) |
| **WhatsApp** | `WHATSAPP_PROVIDER=mock` | `WHATSAPP_PROVIDER=meta` or `meta_cloud` + Meta Cloud API credentials |
| **Payments** | Use **"Collected cash"** on POS (see below) — no TKH Payments needed | `PAYMENTS_SERVICE_URL` + TKH Payments API key for payment links, KkiaPay, MoMo, etc. |
| **Reconciliation** | `MOBILE_MONEY_PARSER_PROVIDER=mock` — returns empty | `MOBILE_MONEY_PARSER_PROVIDER=llm` + AI config |
| **Fiscal (MECeF/FNE)** | Leave `MECEF_BENIN_JWT`, `FNE_CI_API_KEY` unset — stubs used | Set JWT/API key for sandbox or prod |

---

## Testing Payment Flow Without TKH Payments

When TKH Payments is unavailable or you want to avoid real payment gateways:

1. Create an invoice and open the **POS terminal** at `/invoices/[id]/pos`
2. Use the **"Collected cash"** button (💵) instead of scanning the QR code
3. This marks the invoice as paid locally without calling TKH Payments
4. You can then download A4 or thermal receipts

Payment links (QR code, KkiaPay widget) require a real `PAYMENTS_SERVICE_URL` and TKH Payments service.

---

## Running Tests

### Unit tests (no credentials)

```bash
# Backend — Jest (~255 tests, ~30s)
cd backend
npm test

# Frontend — Vitest
cd frontend
npm test
```

### Integration tests (requires credentials + running server)

Backend integration tests hit live APIs and need:

- Backend server running: `npm run dev` in `backend/`
- `INTEGRATION_TEST_EMAIL` and `INTEGRATION_TEST_PASSWORD` for a real test user
- Or `INTEGRATION_TEST_TOKEN` (JWT)
- Optional: `INTEGRATION_TEST_API_URL` (default: `http://localhost:3001`)

```bash
cd backend
INTEGRATION_TEST_EMAIL=test@example.com INTEGRATION_TEST_PASSWORD=secret npm run test:integration
```

Tests: `api.integration.spec.ts`, `PaymentsClient.integration.spec.ts`, `MoMo.e2e.spec.ts`.

### E2E Playwright (requires credentials + running frontend)

Frontend E2E tests need:

- Frontend running: `npm run dev` in `frontend/` (or Playwright starts it)
- Backend running: `npm run dev` in `backend/`
- `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` for auth tests

```bash
cd frontend
E2E_TEST_EMAIL=test@example.com E2E_TEST_PASSWORD=secret npm run test:e2e
```

Or with UI:

```bash
E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npm run test:e2e:ui
```

### KkiaPay live E2E (nightly)

To run the **KkiaPay payment flow** against real TKH Payments + KkiaPay sandbox:

- Requires: `PAYMENTS_SERVICE_URL`, `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY`, `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`
- Backend and frontend must be running
- Run: `cd frontend && ./scripts/run-live-kkiapay-test.sh`

See [backend/docs/KKIAPAY_LIVE_TEST.md](../backend/docs/KKIAPAY_LIVE_TEST.md) for full details, test phone numbers, and CI/nightly setup.

---

## INTEGRATION_TEST_EMAIL / E2E_TEST_EMAIL Setup

| Variable | Used by | Purpose |
|----------|---------|---------|
| `INTEGRATION_TEST_EMAIL` | Backend Jest (`jest.setup.js`, `api.integration.spec.ts`) | Login to get JWT for API integration tests |
| `INTEGRATION_TEST_PASSWORD` | Backend Jest | Password for test user |
| `E2E_TEST_EMAIL` | Frontend Playwright (`auth.setup.ts`, `auth.spec.ts`, `dashboard.spec.ts`, `journeys.spec.ts`) | Login for E2E auth and dashboard tests |
| `E2E_TEST_PASSWORD` | Frontend Playwright | Password for E2E test user |

Create a dedicated test user (e.g. `qa@example.com`) in your dev environment and set these env vars. Do not commit real credentials.

---

## Further Reading

- [README.md](../README.md) — Quick start, CDK deploy, project structure
- [STABILIZATION.md](../STABILIZATION.md) — Feature status, env var table, known limitations
- [backend/docs/](../backend/docs/) — Integration guides (MoMo, MECeF, payments, SES)
- [backend/docs/KKIAPAY_LIVE_TEST.md](../backend/docs/KKIAPAY_LIVE_TEST.md) — KkiaPay live E2E and nightly CI
- [docs/INTEGRATION_TEST_PLAN.md](./INTEGRATION_TEST_PLAN.md) — Integration test coverage
- [docs/FRONTEND_E2E.md](./FRONTEND_E2E.md) — E2E test details
