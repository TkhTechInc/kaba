# Kaba Payment Points — KkiaPay & MTN MoMo

All payment points show **both** KkiaPay and MTN MoMo when both gateways are configured and the currency is supported. The user chooses which to use.

## Payment Points

| Point | Route | Backend | Both Shown |
|-------|-------|---------|------------|
| Invoice payment | `/pay/[token]` | `InvoiceShareService.getInvoiceByToken` | Yes |
| Plan upgrade | `/pay/plan/[token]` | `PlanPaymentService.getPayData` | Yes |
| Storefront | `/pay/storefront/[token]` | `StorefrontPaymentService.getPayData` | Yes |
| Customer portal | `/portal/[businessId]` | Links to `/pay/[token]` per invoice | Yes |
| POS mode | `/invoices/[id]/pos` | QR → `/pay/[token]` | Yes |

## Supported Currencies

| Gateway | Currencies |
|---------|------------|
| KkiaPay | XOF, XAF, GNF |
| MTN MoMo | XOF, XAF, GNF, GHS |

When both are configured for XOF/XAF/GNF, both CTAs appear. For GHS, only MoMo appears.

## Env Vars

**KkiaPay (collection):**
- `KKIAPAY_PRIVATE_KEY`
- `KKIAPAY_WEBHOOK_SECRET`
- Frontend: `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY`, `NEXT_PUBLIC_KKIAPAY_SANDBOX`

**MTN MoMo (collection):**
- `MOMO_API_USER`
- `MOMO_API_KEY`
- `MOMO_SUBSCRIPTION_KEY`
- `MOMO_BASE_URL`, `MOMO_TARGET_ENV`

**MTN MoMo (disbursement):**
- `MOMO_DISBURSEMENT_API_USER`
- `MOMO_DISBURSEMENT_API_KEY`
- `MOMO_DISBURSEMENT_SUBSCRIPTION_KEY`

## API Endpoints

| Flow | MoMo Request | KkiaPay Confirm |
|------|--------------|-----------------|
| Invoice | `POST /api/v1/invoices/pay/request-momo` | `POST /api/v1/invoices/pay/confirm-kkiapay` |
| Plan | `POST /api/v1/plans/pay/request-momo` | `POST /api/v1/plans/pay/confirm-kkiapay` |
| Storefront | `POST /api/v1/storefront/pay/request-momo` | `POST /api/v1/storefront/pay/confirm-kkiapay` |

## Reconciliation (MoMo SMS)

Mobile money reconciliation parses MoMo SMS (MTN, Moov, etc.) to match transactions to invoices or create ledger entries. Set `MOBILE_MONEY_PARSER_PROVIDER=llm` and configure `AI_PROVIDER` (and API keys) for real parsing. With `mock`, parsing returns empty.
