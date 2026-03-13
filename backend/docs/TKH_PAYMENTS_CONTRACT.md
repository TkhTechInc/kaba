# TKH Payments API Contract

Source of truth for the TKH Payments API as called by Kaba. Use this doc to keep nock mocks aligned with the actual `PaymentsClient` behavior.

## Base URL

- **Env var:** `PAYMENTS_SERVICE_URL` (required)
- **Example:** `https://payments.tkhtech.com/api/v1`
- Trailing slashes are stripped by the client.

## Authentication

- **Header:** `X-API-Key`
- **When:** Sent only when `TKH_PAYMENTS_API_KEY` is set.
- **Value:** Value of `TKH_PAYMENTS_API_KEY`.

## Request Defaults

- **Content-Type:** `application/json`
- **Timeout:** 15 seconds

---

## Endpoints

### 1. POST /intents — Create payment intent

**Method:** `POST`  
**Path:** `/intents`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | yes | Amount in minor units |
| `currency` | string | yes | ISO 4217 (e.g. XOF, GHS) |
| `country` | string | no | Defaults to `"DEFAULT"` if omitted |
| `metadata` | object | yes | See below |
| `returnUrl` | string | no | Redirect URL after payment |
| `gatewayOverride` | string | no | e.g. `"momo"` to force MoMo flow |

**metadata (key fields):**

| Field | Type | Required |
|-------|------|----------|
| `appId` | string | yes |
| `referenceId` | string | yes |
| `customerId` | string | no |
| `customerEmail` | string | no |
| `phoneNumber` | string | no |
| `businessId` | string | no |
| `[key: string]` | string | no | Additional metadata |

**Response (200):**

```json
{
  "id": "intent-xxx",
  "status": "pending",
  "paymentUrl": "https://...",
  "clientSecret": "..."
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Intent ID |
| `status` | string | e.g. `"pending"` |
| `paymentUrl` | string | Optional; for redirect flows |
| `clientSecret` | string | Optional; for widget flows |

---

### 2. GET /config — Payment options

**Method:** `GET`  
**Path:** `/config?currency={currency}&country={country}`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | yes | ISO 4217 (e.g. XOF, GHS) |
| `country` | string | no | ISO 3166-1 alpha-2 (e.g. BJ, GH) |

**Response (200):**

```json
{
  "useKkiaPayWidget": true,
  "useMomoRequest": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `useKkiaPayWidget` | boolean | Whether to show KkiaPay widget |
| `useMomoRequest` | boolean | Whether to show MoMo request-to-pay form |

---

### 3. POST /intents/request-momo — MoMo request-to-pay

**Method:** `POST`  
**Path:** `/intents/request-momo`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | number | yes | Amount in minor units |
| `currency` | string | yes | ISO 4217 (e.g. XOF, GHS) |
| `phone` | string | yes | Customer phone (e.g. +22997123456) |
| `countryCode` | string | no | ISO 3166-1 alpha-2 |
| `metadata` | object | yes | Record<string, string> |

**metadata (typical keys):** `appId`, `referenceId`, `invoiceId`, `paymentIntentId`, `businessId`, etc.

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

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | Client treats `success !== false` as success |
| `error` | string | Optional; error message when `success` is false |

---

### 4. POST /intents/verify-kkiapay — Verify KkiaPay transaction

**Method:** `POST`  
**Path:** `/intents/verify-kkiapay`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionId` | string | yes | KkiaPay transaction ID |
| `intentId` | string | yes | Payment intent ID |

**Response (200):**

```json
{
  "success": true,
  "verified": true
}
```

or

```json
{
  "success": false,
  "verified": false,
  "error": "Transaction not found",
  "message": "Transaction not found"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | Optional |
| `verified` | boolean | Client treats `verified === true` OR `success === true` as success |
| `error` | string | Optional |
| `message` | string | Optional; used as fallback for error message |

---

### 5. POST /disbursements — Disburse to mobile money

**Method:** `POST`  
**Path:** `/disbursements`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | yes | Recipient phone (e.g. +22997123456) |
| `amount` | number | yes | Amount in minor units |
| `currency` | string | yes | ISO 4217 (e.g. XOF) |
| `externalId` | string | yes | Idempotency / reference ID |

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

| Field | Type | Notes |
|-------|------|-------|
| `success` | boolean | Client treats `success !== false` as success |
| `transactionId` | string | Optional; disbursement transaction ID |
| `error` | string | Optional; error message when `success` is false |

---

## Error Handling (4xx / 5xx)

On non-2xx responses, the client:

1. Parses the response body as JSON (falls back to `{}` on parse failure).
2. Reads `message` from the body for the error message.
3. Throws: `Error((data.message) ?? "Payments service error {status}")`.

**Expected error response shape:**

```json
{
  "message": "Human-readable error message"
}
```

| Field | Type | Notes |
|-------|------|-------|
| `message` | string | Shown to caller; fallback is `"Payments service error {status}"` |

---

## Nock Mock Reference

Example nock setup for tests:

```javascript
nock('https://payments.tkhtech.com/api/v1')
  .post('/intents', { amount: 5000, currency: 'XOF', country: 'BJ', metadata: { appId: 'kaba', referenceId: 'inv-1' } })
  .reply(200, { id: 'int-1', status: 'pending', paymentUrl: 'https://...' });

nock('https://payments.tkhtech.com/api/v1')
  .get('/config?currency=XOF&country=BJ')
  .reply(200, { useKkiaPayWidget: true, useMomoRequest: false });

nock('https://payments.tkhtech.com/api/v1')
  .post('/intents/request-momo', { amount: 5000, currency: 'XOF', phone: '+22997123456', metadata: {} })
  .reply(200, { success: true });

nock('https://payments.tkhtech.com/api/v1')
  .post('/intents/verify-kkiapay', { transactionId: 'tx-1', intentId: 'int-1' })
  .reply(200, { success: true, verified: true });

nock('https://payments.tkhtech.com/api/v1')
  .post('/disbursements', { phone: '+22997123456', amount: 2500, currency: 'XOF', externalId: 'ext-1' })
  .reply(200, { success: true, transactionId: 'disb-1' });
```

With API key:

```javascript
nock('https://payments.tkhtech.com/api/v1')
  .matchHeader('X-API-Key', 'secret-key')
  .post('/intents', body => body.amount === 5000)
  .reply(200, { id: 'int-1', status: 'pending' });
```
