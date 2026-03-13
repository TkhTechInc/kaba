# Kaba — Stabilization Status

**Goal:** Freeze feature development and ensure the project builds, runs, and is ready for testing/deployment.

---

## Completed

| Item | Status |
|------|--------|
| Backend TypeScript build | Passes |
| Backend type-check | Passes |
| Backend ESLint | Installed — 0 errors, warnings only |
| Frontend TypeScript build | Passes |
| Frontend lint | Passes |
| Stripe package | Installed (`stripe`) |
| `LedgerRepository.listAllByBusinessForBalance` | Returns `category` and `currency` for AI/reports |
| Payment routing | Country-based (not currency) |
| TKH Payments microservice integration | `PaymentsClient` replaces local gateway manager |
| KkiaPay JS widget | Supported on `/pay/[token]` public page |
| SNS payment event handler | Lambda subscribes to `tkhtech-payment-events-dev`, marks invoices paid, creates ledger entries |
| CDK — dev environment | Deployed to `ca-central-1` (Kaba AWS account `110044886269`) |
| CI/CD (GitHub Actions) | `ci.yml` on PRs (lint, type-check, `npm test` runs Jest), `deploy.yml` on `main` push / tag |
| Global search | `GlobalSearch.tsx`, `use-global-search.ts`, `date-range-filter.tsx` committed |

---

## Scripts

```bash
# Backend
cd backend
npm run build
npm run type-check
npm run lint
npm test          # Jest — 21+ spec files
npm run dev

# Frontend
cd frontend
npm run build
npm run dev
```

---

## Environment Variables

### Backend (Lambda — set in CDK / `.env` locally)

| Variable | Description |
|----------|-------------|
| `PAYMENTS_SERVICE_URL` | TKH Payments microservice base URL |
| `DYNAMODB_TABLE_NAME` | DynamoDB table for Kaba data |
| `JWT_SECRET` | JWT signing secret |

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

## Known Limitations

- **Tests:** No Playwright/Cypress in frontend. Backend has 21+ Jest spec files; CI runs `npm test` (Jest).
- **Reconciliation:** Mobile money SMS parsing requires `MOBILE_MONEY_PARSER_PROVIDER=llm` and AI config for real parsing; mock returns empty.
- **WhatsApp:** Only Meta Cloud API supported; Twilio and Africa's Talking providers are TODO.
- **Staging/Prod payments config:** `paymentsServiceUrl` and `paymentsSnsTopicArn` must be supplied via CDK context at deploy time (no hardcoded staging/prod URLs yet).
- **KkiaPay webhook:** Payment webhook verification uses `KKIAPAY_PRIVATE_KEY` — must be set in Lambda environment for prod.

---

*Last updated: Payments integration + ESLint + CI pipeline fixes*
