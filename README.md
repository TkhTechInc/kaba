# Kaba — MSME Accounting SaaS for West Africa

NestJS backend + Next.js frontend, deployed on AWS Lambda + DynamoDB via CDK.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20 LTS | Run `nvm use` (reads `.nvmrc`) |
| npm | bundled with Node | — |
| AWS CLI | v2 | `aws configure` with access to account `110044886269`, region `ca-central-1` |
| AWS CDK | bundled as dev dep | `npx cdk` from `backend/` |

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

## Quick Start

### 1. Clone and use correct Node version

```bash
git clone <repo-url>
cd quickbooks
nvm use          # installs Node 20 from .nvmrc
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — see "Minimum required env vars" below
npm install
npm run dev      # → http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev      # → http://localhost:3000
```

---

## Minimum Required Environment Variables

Edit `backend/.env` — most things default to `mock` or `disabled`. These are the ones you actually need to start the server:

```bash
# Required
JWT_SECRET=any-long-random-string

# AWS (DynamoDB, SES, SNS, S3)
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Point at the deployed dev DynamoDB tables (ask the team for table names, or deploy CDK first)
DYNAMODB_TABLE_NAME=Kaba-LedgerService-dev-ledger
# DYNAMODB_LEDGER_TABLE, DYNAMODB_INVOICES_TABLE, etc. — see .env.example

# Admin access (your phone/email)
ADMIN_PHONES=+1234567890
ADMIN_EMAILS=you@example.com

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001
```

Everything else (SMS, WhatsApp, AI, payments, fiscal) defaults to `mock` or `false` and can be left blank for local development.

Edit `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## DynamoDB — Local vs AWS

**Easiest path (recommended):** Use the existing deployed dev tables in `ca-central-1`. Ask the team for the table names (or see `STABILIZATION.md`). Just set your AWS credentials and the table name env vars.

**First time / fresh deploy:** Deploy the CDK stacks first (see below), then the table names will be output by CDK.

---

## CDK Deploy (first time or after infra changes)

```bash
cd backend

# First time only — bootstrap CDK in the AWS account
npx cdk bootstrap --qualifier tkh aws://110044886269/ca-central-1

# Deploy all stacks to dev
npm run cdk:deploy

# Or build + bundle + deploy in one shot
npm run cdk:deploy:full
```

Other environments:

```bash
npm run cdk:deploy:staging
npm run cdk:deploy:prod
```

---

## Running Tests

```bash
# Backend — Jest (255 unit tests, ~30s)
cd backend
npm test

# Frontend — Vitest
cd frontend
npm test

# Backend integration tests (requires live AWS + running server)
cd backend
npm run test:integration
```

---

## Project Structure

```
quickbooks/
├── backend/              # NestJS API + CDK infrastructure
│   ├── src/
│   │   ├── domains/      # 30+ domain modules (ledger, invoicing, payments, tax, ai, ...)
│   │   ├── infrastructure/  # CDK stacks + Lambda handlers
│   │   ├── nest/         # NestJS entry point, AppModule, guards
│   │   └── shared/       # DomainError, utils
│   ├── scripts/          # Seed, MoMo setup, MECeF sandbox test, SES verification
│   ├── docs/             # Integration guides (MoMo, MECeF, payments, auth)
│   └── .env.example      # Full env var reference (223 lines)
├── frontend/             # Next.js 16 app
│   └── .env.example      # Frontend env vars
├── docs/                 # Project-level docs (security, test plans, MCP agent)
├── AGENTS.md             # AI agent coordination + domain architecture
├── STABILIZATION.md      # Feature status, env var table, deploy commands
└── .github/workflows/    # CI (lint + test on PR), CD (deploy on main/tag)
```

---

## Key Scripts (backend)

| Command | What it does |
|---------|-------------|
| `npm run dev` | Local NestJS server on :3001 |
| `npm run build` | TypeScript compile |
| `npm run type-check` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run bundle` | Build Lambda bundles (esbuild) |
| `npm run seed` | Seed DynamoDB with sample data |
| `npm run cdk:deploy` | Deploy all CDK stacks to dev |
| `npm run mecef:sandbox-test` | Test Benin e-MECeF sandbox integration |

---

## CI/CD

- **PRs:** GitHub Actions runs lint + type-check + tests for both backend and frontend
- **`main` branch push:** Auto-deploys to dev (Lambda + API Gateway via CDK)
- **Version tags `v*`:** Auto-deploys to prod

Deployment uses AWS OIDC (no long-lived keys in CI). See `.github/workflows/deploy.yml`.

---

## Further Reading

- `STABILIZATION.md` — full env var table, known limitations, what's working
- `AGENTS.md` — domain architecture and agent workstreams
- `backend/docs/` — integration-specific guides (MoMo, MECeF, payments, SES, API keys)
- `docs/` — security checklist, test plans, MCP agent docs
