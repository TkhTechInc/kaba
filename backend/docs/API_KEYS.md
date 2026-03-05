# API Keys

API keys authenticate server-to-server or programmatic access. **API keys use scopes, not role.**

## Scopes vs Role

- **JWT (user auth)**: Permissions are derived from the user's **role** (owner, accountant, viewer) for each business.
- **API keys**: Permissions are defined by **scopes** assigned when the key is created. Each scope maps to a permission (e.g. `ledger:read`, `invoices:write`).

## Supported Scopes

API key scopes align with the `Permission` type:

| Scope | Description |
|-------|-------------|
| `ledger:read` | Read ledger entries and balance |
| `ledger:write` | Create ledger entries |
| `invoices:read` | List and get invoices, customers |
| `invoices:write` | Create, update, delete invoices, customers |
| `reports:read` | Access reports |
| `reports:write` | (Reserved) |
| `receipts:read` | (Reserved) |
| `receipts:write` | Upload and process receipts |
| `ai:read` | AI query, voice-to-transaction |
| `lending:read` | Loan readiness (for banks / Lending-as-a-Service) |
| `tax:read` | VAT and tax calculations |
| `features:read` | Get feature flags for business |
| `webhooks:read` | List webhooks |
| `webhooks:write` | Register and unregister webhooks |
| `api_keys:read` | List API keys |
| `api_keys:write` | Create and revoke API keys |

## Usage

Include the API key in the `Authorization` header:

```
Authorization: Bearer qb_live_xxxxxxxxxxxx
```

All requests must include `businessId` in the body or query. The API key is scoped to a single business.

## PermissionGuard Behavior

- **JWT**: `PermissionGuard` calls `AccessService.canAccess(businessId, userId, permission)` using the user's role.
- **API key**: `PermissionGuard` checks `user.scopes.includes(permission)` and `user.businessId === request.businessId`. No role lookup.
