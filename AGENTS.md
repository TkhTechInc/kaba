# Kaba - Agent Coordination

This document guides AI agents working on this project. Follow the plan in `.cursor/plans/` and the rules in `.cursor/rules/`.

**Stabilization:** See `STABILIZATION.md`. Feature freeze in effect — fix bugs and improve stability only.

## Project Context

- **Product**: MSME accounting MSME accounting SaaS for West Africa
- **Stack**: NestJS backend, DynamoDB, CDK, interface-based design
- **Reference**: Patterns from `/projects/events` (TKH-TECH)

## Rules (Always Apply)

1. **Read `.cursor/rules/`** – TypeScript, domain architecture, API, DynamoDB patterns
2. **Interface-first** – Define `IPaymentGateway`, `ILLMProvider`, `IReceiptExtractor`, etc.; no concrete implementations in core
3. **AI model agnostic** – Use `ILLMProvider`; never reference Bedrock/Claude directly in domain code
4. **Multi-tenant** – All entities have `businessId`; queries filter by it

## Agent Workstreams

### Agent 1: Backend Scaffold
- Create `backend/` with NestJS, package.json, tsconfig
- DynamoDBModule, ConfigModule, HealthController
- AppModule with minimal imports
- Shared: DomainError, logger, path aliases

### Agent 2: Domain – Ledger
- `domains/ledger/`: Business, LedgerEntry models
- LedgerRepository (DynamoDB)
- LedgerService
- LedgerModule, LedgerController
- REST: `POST /api/v1/ledger/entries`, `GET /api/v1/ledger/entries`

### Agent 3: Domain – Invoicing & Payments
- `domains/invoicing/`: Invoice, Customer models
- `domains/payments/`: IPaymentGateway interface (copy from events), PaymentGatewayManager
- InvoiceRepository, InvoiceService
- Payment webhook handler stub
- REST: invoices CRUD, payment link generation

### Agent 4: Domain – Tax & AI Interfaces
- `domains/tax/`: ITaxEngine interface, NigeriaTaxEngine stub
- `domains/ai/`: ILLMProvider, IReceiptExtractor, ISpeechToText interfaces
- Stub implementations (MockReceiptExtractor, etc.)
- Wire via NestJS DI

### Agent 5: Infrastructure
- CDK: LedgerServiceStack (DynamoDB table)
- KabaApiStack (Lambda, API Gateway)
- Environment config (dev/staging/prod)

## Coordination

- **No overlap**: Each agent owns its workstream; do not modify another agent's files without explicit handoff
- **Shared files**: `DomainError`, `DynamoDBModule`, `AppModule` – Agent 1 creates; others extend
- **Interfaces first**: Agent 4 defines interfaces; Agent 2/3 use them via DI
- **Merge order**: 1 → 2 → 3 → 4 → 5 (scaffold before domains, domains before infra)

## File Paths

- Backend: `backend/`
- Rules: `.cursor/rules/`
- Plan: `.cursor/plans/` or `~/.cursor/plans/`

## When Stuck

- Check events project: `../events/backend/src/`
- Follow plan phases; do not skip to Phase 2 before Phase 1 is complete
- Prefer stub/mock over full implementation when time-constrained
