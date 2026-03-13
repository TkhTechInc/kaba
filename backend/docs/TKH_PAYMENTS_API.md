# TKH Payments API Contract

Kaba routes **all** payment operations through the TKH Payments microservice (payment gateway aggregator). This document describes the API contract that TKH Payments must implement.

**For Kaba developers:** See [TKH_PAYMENTS_GUIDE.md](./TKH_PAYMENTS_GUIDE.md) for how to use TKH Payments from this repo.

## Required Environment

- `PAYMENTS_SERVICE_URL` — Base URL of the TKH Payments service (required; app fails to start without it)

## Endpoints

### POST /intents

Create a payment intent. Returns payment URL or client secret for redirect/widget flows.

**Request:**
```json
{
  "amount": 50000,
  "currency": "XOF",
  "country": "BJ",
  "metadata": {
    "appId": "kaba",
    "referenceId": "inv-xxx",
    "businessId": "biz-xxx",
    "customerId": "cust-xxx",
    "invoiceId": "inv-xxx",
    "phoneNumber": "+22997123456"
  },
  "returnUrl": "https://..."
}
```

**Response (200):**
```json
{
  "id": "intent-xxx",
  "status": "pending",
  "paymentUrl": "https://...",
  "clientSecret": "..."
}
```

---

### GET /config?currency=XOF&country=BJ

Get payment options for a currency/country. Used to decide whether to show KkiaPay widget and/or MoMo request-to-pay form.

**Response (200):**
```json
{
  "useKkiaPayWidget": true,
  "useMomoRequest": true
}
```

---

### POST /intents/request-momo

Initiate MoMo/Moov Africa request-to-pay. Sends push to customer's phone.

**Request:**
```json
{
  "amount": 50000,
  "currency": "XOF",
  "phone": "+22997123456",
  "countryCode": "BJ",
  "metadata": {
    "businessId": "biz-xxx",
    "invoiceId": "inv-xxx",
    "referenceId": "plan-token",
    "paymentIntentId": "qb-xxx"
  }
}
```

**Response (200):**
```json
{
  "success": true
}
```
or
```json
{
  "success": false,
  "error": "Insufficient funds"
}
```

---

### POST /verify/kkiapay

Verify a KkiaPay widget transaction.

**Request:**
```json
{
  "transactionId": "kkiapay-tx-xxx"
}
```

**Response (200):**
```json
{
  "success": true
}
```
or
```json
{
  "success": false,
  "error": "Transaction not found"
}
```

---

### POST /disbursements

Disburse to mobile money (e.g. supplier payout).

**Request:**
```json
{
  "phone": "+22997123456",
  "amount": 25000,
  "currency": "XOF",
  "externalId": "qb-biz-xxx-sup-xxx-entry-xxx"
}
```

**Response (200):**
```json
{
  "success": true,
  "transactionId": "tx-xxx"
}
```
or
```json
{
  "success": false,
  "error": "Insufficient balance"
}
```

---

## Webhook Flow

Gateways (MoMo, KkiaPay, Moov Africa, etc.) send webhooks to **TKH Payments**, not to Kaba. TKH Payments:

1. Receives webhooks from gateways
2. Verifies signatures
3. Publishes `payment.completed` events to SNS (`tkhtech-payment-events-*`)
4. Kaba's payment-event Lambda subscribes to SNS and marks invoices/plans/storefront as paid

Event format:
```json
{
  "type": "payment.completed",
  "appId": "kaba",
  "referenceId": "inv-xxx",
  "businessId": "biz-xxx",
  "amount": 50000,
  "currency": "XOF",
  "gatewayTransactionId": "tx-xxx",
  "intentId": "intent-xxx"
}
```

For plan upgrades, `referenceId` may be `plan-{token}`. For storefront, `referenceId` may be `storefront-{token}`. Kaba's payment-event Lambda should handle these reference types.
