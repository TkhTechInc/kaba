# TKH Payments — Developer Guide

**Rule:** No payment logic is handled in this repo. All payment operations go through the **TKH Payments** aggregator. Pass the relevant info to it; it handles gateways (KkiaPay, MoMo, Moov Africa, Stripe, Paystack, etc.).

---

## Quick Reference

| Use Case | PaymentsClient Method | What to Pass |
|----------|----------------------|--------------|
| Create payment link (redirect) | `createIntent()` | amount, currency, country, metadata (appId, referenceId, businessId, …) |
| Check payment options (widget vs MoMo form) | `getPayConfig()` | currency, countryCode |
| MoMo/Moov request-to-pay | `requestMoMoPayment()` | amount, currency, phone, countryCode, metadata |
| Verify KkiaPay widget payment | `verifyKkiaPayTransaction()` | transactionId |
| Refund succeeded payment | `refund()` | intentId, optional amount, reason |
| Disburse to mobile money | `disburse()` | phone, amount, currency, externalId |

---

## Setup

### Required

- `PAYMENTS_SERVICE_URL` — Base URL of TKH Payments (e.g. `https://payments.tkhtech.com/api/v1`)
- App fails to start if this is not set.

### Injection

```ts
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';

@Injectable()
export class MyService {
  constructor(private readonly paymentsClient: PaymentsClient) {}
}
```

`PaymentModule` is `@Global()`, so `PaymentsClient` is available wherever `PaymentModule` is imported (e.g. via `AppModule`).

---

## Use Cases & What to Pass

### 1. Create Payment Intent (redirect / card flow)

Use when you need a `paymentUrl` or `clientSecret` for redirect or Stripe Elements.

```ts
const result = await this.paymentsClient.createIntent({
  amount: 50000,
  currency: 'XOF',
  country: business.countryCode,  // e.g. 'BJ', 'GH', 'NG'
  metadata: {
    appId: 'kaba',                    // or 'kaba-storefront', 'kaba-plan'
    referenceId: invoice.id,          // invoiceId, plan token, or synthetic ID
    businessId: business.id,
    invoiceId: invoice.id,            // optional, for invoice context
    customerId: invoice.customerId,   // optional
    customerEmail: customer.email,    // optional
    phoneNumber: customer.phone,      // optional, for MoMo prefill
  },
  returnUrl: 'https://...',           // optional
});

if (result.success && result.paymentUrl) {
  // Redirect user to result.paymentUrl
}
```

**Metadata rules:**
- `appId` — `kaba` (invoice), `kaba-storefront`, `kaba-plan`
- `referenceId` — ID used in SNS events (invoice ID, `plan-{token}`, `storefront-{token}`)
- `businessId` — Always include for multi-tenant

---

### 2. Get Payment Options (widget vs MoMo form)

Use before showing the pay page to decide whether to show KkiaPay widget and/or MoMo phone form.

```ts
const payConfig = await this.paymentsClient.getPayConfig(
  currency,        // e.g. 'XOF', 'XAF', 'GHS'
  countryCode,     // e.g. 'BJ', 'GH' (optional)
);

if (payConfig.useKkiaPayWidget) {
  // Show KkiaPay widget (XOF/XAF/GNF)
}
if (payConfig.useMomoRequest) {
  // Show MoMo phone input for request-to-pay
}
```

---

### 3. MoMo / Moov Request-to-Pay

Use when the user enters their phone and you want to push a payment request to their device.

```ts
const result = await this.paymentsClient.requestMoMoPayment({
  amount: 50000,
  currency: 'XOF',
  phone: normalizedPhone,      // E.164, e.g. '+22997123456'
  countryCode: business.countryCode,
  metadata: {
    businessId: record.businessId,
    invoiceId: record.invoiceId,        // or plan/storefront reference
    referenceId: `plan-${token}`,       // for plan/storefront
    paymentIntentId: externalId,       // e.g. `qb-{businessId}-{invoiceId}-{timestamp}`
  },
});

if (result.success) {
  // User will receive push on phone; webhook → SNS → Kaba marks paid
}
```

**Metadata rules:**
- `invoiceId` — For invoice payments
- `referenceId` — For plan (`plan-{token}`) or storefront (`storefront-{token}`)
- `paymentIntentId` — Unique external ID for idempotency

---

### 4. Verify KkiaPay Widget Payment

Use after the KkiaPay widget redirects back with a `transactionId`.

```ts
const verify = await this.paymentsClient.verifyKkiaPayTransaction(transactionId);

if (verify.success) {
  // Mark invoice/plan/storefront as paid
} else {
  // Show verify.error to user
}
```

---

### 5. Disburse to Mobile Money (supplier payout)

Use when paying a supplier via mobile money.

```ts
const result = await this.paymentsClient.disburse({
  phone: supplier.momoPhone ?? supplier.phone,   // E.164
  amount: 25000,
  currency: 'XOF',
  externalId: `qb-${businessId}-${supplierId}-${ledgerEntryId}`,
});

if (result.success) {
  // Ledger entry already created; disbursement initiated
} else {
  // Log result.error; ledger entry still exists
}
```

**externalId** — Unique per disbursement for idempotency and reconciliation.

---

## What Kaba Does NOT Do

- Do not call KkiaPay, MoMo, Moov Africa, Stripe, or Paystack APIs directly
- Do not register or configure gateways in this repo
- Do not handle gateway webhooks (TKH Payments receives them)
- Do not implement `IPaymentGateway` or similar in this repo

---

## Flow Overview

```
┌─────────────┐     PaymentsClient      ┌──────────────────┐     Gateways      ┌─────────────┐
│   Kaba      │ ──────────────────────► │  TKH Payments     │ ────────────────► │ KkiaPay     │
│             │  createIntent()          │  (aggregator)     │                   │ MoMo        │
│             │  getPayConfig()          │     │             │                   │ Moov Africa │
│             │  requestMoMoPayment()   │     │ webhooks    │                   │ Stripe      │
│             │  verifyKkiaPayTransaction│     ▼             │                   │ Paystack    │
│             │  disburse()              │  SNS topic       │                   └─────────────┘
│             │                          └────────┬─────────┘
│             │                                   │
│             │  payment-event Lambda             │ payment.completed
│             │ ◄─────────────────────────────────┘
│             │  (marks invoice/plan/storefront paid)
└─────────────┘
```

---

## API Contract

See [TKH_PAYMENTS_API.md](./TKH_PAYMENTS_API.md) for the full API contract that TKH Payments must implement.

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYMENTS_SERVICE_URL` | Yes | TKH Payments base URL (e.g. `https://payments.tkhtech.com/api/v1`) |

---

## Adding a New Payment Flow

1. Identify the flow: intent (redirect), widget, MoMo request, or disbursement.
2. Use the matching `PaymentsClient` method.
3. Pass the required metadata (`appId`, `referenceId`, `businessId`) so SNS events can be routed correctly.
4. Do not add new gateway integrations in this repo.
