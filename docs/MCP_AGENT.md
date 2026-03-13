# Kaba MCP Agent — Implementation Reference

## Overview

The MCP (Model Context Protocol) Agent layer adds an AI-powered conversational interface to Kaba. It exposes structured **tools** backed by existing domain services, which an LLM can call iteratively to answer natural-language questions and take actions on behalf of the user.

Three user scopes are supported:
- **Business** — authenticated business owners querying and managing their own data
- **Customer** — unauthenticated customers accessing their invoices through the public portal
- **Admin** — internal admin users with platform-wide visibility

WhatsApp is explicitly excluded from this phase. The agent is accessed via the web app chat widget and REST API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Clients                                                        │
│  AgentChatWidget (business)  ·  portal/[businessId] (customer) │
│  Admin dashboard             ·  API consumers (banks, MFIs)    │
└───────────────────┬─────────────────────────────────────────────┘
                    │  POST /api/v1/mcp/chat
                    │  POST /api/v1/mcp/portal/chat
                    │  POST /api/v1/mcp/admin/chat
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  McpController  (30 req/min throttle)                          │
└───────────────────┬─────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  AgentOrchestrator                                              │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐ │
│  │ FeatureService  │  │  ToolRegistry│  │ AgentSessionStore │ │
│  │ (tier gate)     │  │  (tool map)  │  │ (DynamoDB, 24h)   │ │
│  └─────────────────┘  └──────┬───────┘  └───────────────────┘ │
│                               ▼                                 │
│              AI_LEDGER_QA_PROVIDER (Llama 3.3 70B)             │
│              5-iteration tool-call loop                         │
└───────────────────────────────────────────────────────────────-─┘
                    │  tool.execute(input, ctx)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Domain Services (existing, unchanged)                          │
│  LedgerService · InvoiceService · DebtService · ProductService  │
│  SupplierService · TrustScoreService · ReportService · ...      │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
backend/src/domains/mcp/
├── mcp.tokens.ts                    # MCP_TOOLS injection token
├── McpModule.ts                     # NestJS module wiring
├── McpController.ts                 # 3 REST endpoints
├── AgentOrchestrator.ts             # Core agent loop
├── AgentSessionStore.ts             # DynamoDB session persistence
├── ToolRegistry.ts                  # Tool map + OpenAI definitions
├── dto/
│   └── mcp-chat.dto.ts              # Request DTOs (3 classes)
├── interfaces/
│   ├── IMcpTool.ts                  # Tool + context interfaces
│   └── IAgentSession.ts             # Session shape
└── tools/
    ├── business/                    # 15 tools
    │   ├── get-balance.tool.ts
    │   ├── list-recent-transactions.tool.ts
    │   ├── record-sale.tool.ts
    │   ├── record-expense.tool.ts
    │   ├── get-profit-loss.tool.ts
    │   ├── list-unpaid-invoices.tool.ts
    │   ├── create-invoice.tool.ts
    │   ├── send-invoice-payment-link.tool.ts
    │   ├── list-debts.tool.ts
    │   ├── check-stock.tool.ts
    │   ├── get-trust-score.tool.ts
    │   ├── list-suppliers.tool.ts
    │   ├── pay-supplier.tool.ts
    │   ├── get-loan-readiness.tool.ts
    │   ├── get-cash-flow-forecast.tool.ts
    │   └── index.ts
    ├── customer/                    # 4 tools
    │   ├── lookup-my-invoices.tool.ts
    │   ├── get-invoice-detail.tool.ts
    │   ├── get-payment-link.tool.ts
    │   ├── get-payment-status.tool.ts
    │   └── index.ts
    └── admin/                       # 6 tools
        ├── list-businesses.tool.ts
        ├── get-business-health.tool.ts
        ├── get-platform-metrics.tool.ts
        ├── set-business-tier.tool.ts
        ├── get-usage-summary.tool.ts
        ├── query-audit-logs.tool.ts
        └── index.ts

frontend/src/
├── services/mcp.service.ts          # API client
├── hooks/use-agent-chat.ts          # Session-aware state hook
└── components/mcp/
    ├── AgentChatWidget.tsx          # Floating chat panel
    ├── AgentMessage.tsx             # Message + tool chip + upgrade CTA
    └── index.ts
```

---

## REST API

### Business Owner Chat

```
POST /api/v1/mcp/chat
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "businessId": "biz_123",
  "message": "Check my balance",
  "sessionId": "optional-uuid-to-continue-session",
  "tier": "pro"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "message": "Your current balance is XOF 1,450,000.",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "toolsUsed": ["get_balance"],
    "upgradeRequired": null
  }
}
```

### Customer Portal Chat

```
POST /api/v1/mcp/portal/chat
Content-Type: application/json
(no auth required)

{
  "businessId": "biz_123",
  "customerEmail": "amara@gmail.com",
  "message": "What do I owe?",
  "sessionId": "optional"
}
```

Customer tools are scoped strictly to the requesting `customerEmail`. Any invoice lookup verifies ownership before returning data.

### Admin Chat

```
POST /api/v1/mcp/admin/chat
Authorization: Bearer <jwt>  (must have admin role)
Content-Type: application/json

{
  "message": "Show me all starter-tier businesses in Benin",
  "sessionId": "optional"
}
```

All three endpoints are throttled at **30 requests per minute** per IP.

---

## Agent Loop (AgentOrchestrator)

The orchestrator implements a **tool-call loop** with a maximum of 5 iterations per user message:

```
1. Load session from DynamoDB (or create new)
2. Check mcp_agent_basic feature flag — gate on tier
3. Append user message to session.messages
4. Build tool list string for the scope
5. Loop (max 5):
   a. Call AI_LEDGER_QA_PROVIDER.generateText() with system prompt + message history
   b. Parse response for {"tool_call": {"name": "...", "input": {...}}}
   c. If tool call found:
      - Check mcp_agent_advanced for write tools
      - Execute tool.execute(input, ctx)
      - Append tool result to messages
      - Continue loop
   d. If no tool call → final answer, break loop
6. Cap messages at 30, save session
7. Return { message, sessionId, toolsUsed, upgradeRequired? }
```

The LLM is instructed to emit tool calls as a JSON line:
```
{"tool_call": {"name": "get_balance", "input": {}}}
```

Write tools (`record_sale`, `record_expense`, `create_invoice`, `pay_supplier`) require `mcp_agent_advanced` (Pro+). Read tools require only `mcp_agent_basic` (Starter+).

**Model used:** `AI_LEDGER_QA_PROVIDER` → `meta-llama/llama-3.3-70b-instruct` via OpenRouter (same model already used for financial Q&A). No new AI provider required.

---

## Tool Interface

Every tool implements `IMcpTool`:

```typescript
export interface IMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;  // JSON Schema
  readonly scopes: McpScope[];                    // which user types can use it
  readonly tierRequired: Tier;                    // minimum tier
  execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown>;
}

export interface McpToolContext {
  businessId: string;
  userId?: string;
  customerEmail?: string;
  tier: Tier;
  scope: McpScope;
}
```

Adding a new tool: create an `@Injectable()` class implementing `IMcpTool`, add it to `McpModule` providers, and add it to the `MCP_TOOLS` factory array.

---

## Tool Reference

### Business Tools (15)

| Tool | Tier | Domain Service | Description |
|---|---|---|---|
| `get_balance` | starter | `LedgerService.getBalance()` | Current account balance |
| `list_recent_transactions` | starter | `LedgerService.listWithCursor()` | Recent sales/expenses |
| `record_sale` | starter | `LedgerService.createEntry()` | Record a sale (write) |
| `record_expense` | starter | `LedgerService.createEntry()` | Record an expense (write) |
| `get_profit_loss` | starter | `ReportService.getPL()` | P&L for a date range |
| `list_unpaid_invoices` | starter | `InvoiceService.listUnpaid()` | Outstanding invoices |
| `create_invoice` | starter | `InvoiceService.create()` | Create a new invoice (write) |
| `send_invoice_payment_link` | pro | `InvoiceShareService.generatePublicToken()` | Share payment link |
| `list_debts` | starter | `DebtRepository.listByBusiness()` | Outstanding debts |
| `check_stock` | starter | `ProductService.list()` | Inventory stock levels |
| `get_trust_score` | starter | `BusinessTrustScoreService.calculate()` | Trust score (0–100) |
| `list_suppliers` | pro | `SupplierService.list()` | Supplier list |
| `pay_supplier` | pro | `SupplierPaymentService.paySupplier()` | MoMo disbursement (write) |
| `get_loan_readiness` | pro | `LoanReadinessService` | Loan eligibility assessment |
| `get_cash_flow_forecast` | pro | `ReportService` | 30-day cash flow projection |

Write tools (`record_sale`, `record_expense`, `create_invoice`, `pay_supplier`) require `mcp_agent_advanced` (Pro+) in addition to their `tierRequired`.

### Customer Tools (4)

All customer tools verify that the requested invoice belongs to `ctx.customerEmail` before returning data.

| Tool | Domain Service | Description |
|---|---|---|
| `lookup_my_invoices` | `InvoiceService.list()` | All invoices for the customer |
| `get_invoice_detail` | `InvoiceService.getById()` | Single invoice with line items |
| `get_payment_link` | `InvoiceShareService.generatePublicToken()` | Pay link (7-day TTL) |
| `get_payment_status` | `InvoiceService.getById()` | Payment status + paidAt |

### Admin Tools (6)

All admin tools are gated behind `AdminGuard` at the controller level.

| Tool | Domain Service | Description |
|---|---|---|
| `list_businesses` | `AdminMetricsService` | List businesses (filter by tier/country) |
| `get_business_health` | `BusinessTrustScoreService` | Trust score for any business |
| `get_platform_metrics` | `AdminMetricsService.getSummary()` | Platform-wide metrics |
| `set_business_tier` | `BusinessRepository.updateTier()` | Force-upgrade a business |
| `get_usage_summary` | `AdminMetricsService` | AI/feature usage per business |
| `query_audit_logs` | `AuditRepository` | Audit trail for any business |

---

## Session Storage

Sessions are stored in DynamoDB table `Kaba-AgentSessions-{stage}`.

| Attribute | Value |
|---|---|
| PK | `AGENT#{sessionId}` |
| SK | `SESSION` |
| TTL | 24 hours from last activity (auto-deleted by DynamoDB) |
| Max messages | 30 (oldest trimmed automatically) |

The table is passed into `KabaApiStack` as the `agentSessionsTable` prop and the Lambda reads `AGENT_SESSIONS_TABLE` from the environment.

---

## Feature Flags

Two new flags added to the existing `FeatureService`:

| Key | Tiers | Limits | Controls |
|---|---|---|---|
| `mcp_agent_basic` | starter, pro, enterprise | 100 / 1,000 / 10,000 calls/month | All read tools + chat access |
| `mcp_agent_advanced` | pro, enterprise | unlimited | Write tools (record, create, pay) |

Free tier users receive an upgrade prompt immediately. The response includes `upgradeRequired: { feature, requiredTier }` which the frontend renders as an inline upgrade CTA.

---

## Frontend Integration

### AgentChatWidget

A floating chat panel mounted in the authenticated app shell and customer portal.

**Business owner** — mounted in `frontend/src/app/(home)/layout.tsx`:
```tsx
{businessId && (
  <AgentChatWidget token={token} businessId={businessId} mode="business" />
)}
```

**Customer portal** — mounted in `frontend/src/app/portal/[businessId]/page.tsx` after successful email verification:
```tsx
<AgentChatWidget
  token={null}
  businessId={businessId}
  customerEmail={customerEmail}
  mode="portal"
/>
```

The widget is positioned fixed bottom-right, 380×520px, with dark mode support. It shows clickable suggestion prompts when the conversation is empty.

### useAgentChat Hook

```typescript
const { messages, isLoading, error, sendMessage, clearMessages } = useAgentChat({
  token,        // JWT token (null for portal)
  businessId,
  customerEmail, // only for portal mode
  mode,          // 'business' | 'portal'
});
```

- Maintains `sessionId` across messages via a `useRef` so the server can retrieve conversation history
- Routes to `portalChat` when `mode === 'portal'` (unauthenticated endpoint)
- `clearMessages()` resets both local state and the session ID ref

### mcp.service.ts

```typescript
const api = createMcpApi(token);

// Business owner
await api.chat(businessId, message, sessionId?);

// Customer portal (no token)
await api.portalChat(businessId, customerEmail, message, sessionId?);
```

---

## Monetization Integration

When a tool requires a higher tier, `AgentOrchestrator` returns:

```typescript
upgradeRequired: { feature: 'mcp_agent_advanced', requiredTier: 'pro' }
```

`AgentMessage.tsx` renders this as an inline upgrade banner with a link to `/settings/plans`. The plans page uses the existing `PlanPaymentService` checkout flow — no new payment infrastructure needed.

---

## Extending the Agent

### Adding a new tool

1. Create `backend/src/domains/mcp/tools/{scope}/my-new-tool.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { SomeService } from '@/domains/some/SomeService';

@Injectable()
export class MyNewTool implements IMcpTool {
  readonly name = 'my_new_tool';
  readonly description = 'What this tool does in plain English';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      someParam: { type: 'string', description: 'What this param does' },
    },
    required: ['someParam'],
  };

  constructor(private readonly someService: SomeService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    return this.someService.doSomething(ctx.businessId, input.someParam as string);
  }
}
```

2. Export from the scope's `index.ts`
3. Add to `McpModule.ts`:
   - Add to `providers` array
   - Add to `MCP_TOOLS` factory `inject` array and return array

### Adding a new scope

1. Add the new value to `McpScope` in `interfaces/IMcpTool.ts`
2. Add a new endpoint in `McpController.ts`
3. Add an auth guard appropriate to the scope
4. Create tools in `tools/{newscope}/`

---

## Cost Estimate

| Component | Cost |
|---|---|
| MCP protocol layer | $0 (code only) |
| New AWS services | $0 (reuses existing Lambda + DynamoDB) |
| AI model per agent turn | ~$0.0005 (Llama 3.3 70B via OpenRouter) |
| Worst case per multi-step message | ~$0.0025 (5 iterations) |
| At 1,000 businesses × 10 chats/day | ~$15–45/month incremental AI cost |
| DynamoDB (AgentSessions table) | ~$1–5/month on-demand at early scale |

The existing OpenRouter API key and `AI_LEDGER_QA_PROVIDER` configuration cover all agent calls — no new credentials required.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_SESSIONS_TABLE` | `Kaba-AgentSessions-dev` | DynamoDB table for agent sessions |
| `AI_LEDGER_QA_MODEL` | `meta-llama/llama-3.3-70b-instruct` | Model used for agent reasoning |
| `OPENROUTER_API_KEY` | — | Already required; no change |

No new secrets or environment variables are required beyond the existing stack.
