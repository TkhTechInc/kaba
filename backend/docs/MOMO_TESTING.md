# MoMo Collection Testing Guide

## Prerequisites

1. **Env vars** in `backend/.env`:
   ```
   MOMO_API_USER=<uuid>
   MOMO_API_KEY=<api-key>
   MOMO_SUBSCRIPTION_KEY=<collections-subscription-key>
   MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
   MOMO_TARGET_ENV=sandbox
   ```

2. **MoMo sandbox** – Use MTN test numbers from [momodeveloper.mtn.com](https://momodeveloper.mtn.com).

## When MoMo Collection Shows

- **GHS (Ghana)**: MoMo is primary; `useMomoRequest` is true.
- **XOF/XAF/GNF**: MoMo shows only when KkiaPay is **not** configured. If `KKIAPAY_PRIVATE_KEY` is set, KkiaPay widget is used instead.

To test MoMo with XOF:
- Unset `KKIAPAY_PRIVATE_KEY` (or remove it from `.env`), or
- Create an invoice in GHS (Ghana).

## Manual Test Steps

1. **Start backend and frontend**
   ```bash
   cd backend && npm run dev
   cd frontend && npm run dev
   ```

2. **Create an invoice**
   - Log in, create an invoice with currency **GHS** (or XOF with KkiaPay disabled).
   - Add a customer with a phone number.

3. **Generate share link**
   - Open the invoice → Share → copy the pay URL (e.g. `http://localhost:3000/pay/<token>`).

4. **Open payment page**
   - Open the pay URL in a browser (or incognito).
   - You should see "Pay with MoMo" and a phone input.

5. **Enter MoMo number**
   - Use a sandbox test number (see MTN docs).
   - Click "Pay with MoMo".
   - A RequestToPay is sent to that number.

6. **Approve on phone**
   - On the sandbox test phone, approve the payment.
   - The page polls and shows "Payment confirmed" when the webhook marks the invoice paid.

## Webhook for Sandbox

For sandbox, MTN sends callbacks to the `providerCallbackHost` you used when creating the API user (e.g. `webhook.site`). For local testing:

1. Use [webhook.site](https://webhook.site) to get a callback URL.
2. When creating the API user, set `providerCallbackHost` to your webhook.site host (e.g. `webhook.site` without `https://`).
3. Or use ngrok to expose your local server and register that URL with MTN.

**Note:** In sandbox, the invoice may be marked paid via webhook only if your callback URL is reachable by MTN. For quick tests, you can manually call `markPaidFromWebhook` or use the MTN sandbox simulator.

## Unit Tests

```bash
cd backend
npx jest --testPathPattern="InvoiceShareService" --no-coverage
```
