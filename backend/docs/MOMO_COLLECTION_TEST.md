# MoMo Collection – Manual Test Guide

MoMo collection (RequestToPay) goes through **TKH Payments**. Use this guide to test end-to-end.

## Prerequisites

1. **TKH Payments** running with MoMo configured (gateway credentials in TKH Payments, not Kaba).

2. **Kaba env** in `backend/.env`:
   ```
   PAYMENTS_SERVICE_URL=https://payments.example.com/api/v1
   ```

3. **MTN sandbox** – Use [MTN MoMo sandbox test numbers](https://momodeveloper.mtn.com/) for the payer phone.

## Flow

1. **Create invoice** with XOF, XAF, GNF, or GHS.
2. **Business** → Invoices → Share → copy the pay URL (e.g. `http://localhost:3000/pay/abc-123-token`).
3. **Open** the pay URL in a browser (incognito or without auth).
4. You should see **"Pay with MoMo"** when TKH Payments returns `useMomoRequest: true` for that currency/country.
5. **Enter** a sandbox MTN MoMo number (e.g. `+233241234567` for Ghana).
6. Click **"Pay with MoMo"**.
7. **Kaba** → TKH Payments → MTN MoMo RequestToPay.
8. **Approve** on the MTN sandbox simulator (or phone if using sandbox).
9. **TKH Payments** receives webhook → publishes to SNS → Kaba payment-event Lambda marks invoice paid.

## When MoMo Shows

TKH Payments `GET /config?currency=XOF&country=BJ` returns `useMomoRequest: true` when MoMo is configured for that currency/country. Kaba uses this to decide what to show.

## API Test (curl)

```bash
# 1. Get token from share link (e.g. /pay/TOKEN)
TOKEN="your-token-from-pay-url"

# 2. Request MoMo payment (Kaba forwards to TKH Payments)
curl -X POST http://localhost:3001/api/v1/invoices/pay/request-momo \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"phone\":\"+233241234567\"}"
```

Expected: `{"success":true,"message":"Payment request sent to your phone..."}`

## Tests

```bash
cd backend

# Unit tests (mocked PaymentsClient)
npx jest --testPathPattern="InvoiceShareService" --no-coverage

# Integration tests (mocked TKH Payments via nock)
npx jest PaymentsClient.integration MoMo.e2e --no-coverage

# Live E2E (real TKH Payments + MoMo sandbox)
MOMO_E2E_LIVE=1 MOMO_E2E_TOKEN=your-token MOMO_E2E_PHONE=+233241234567 \
  PAYMENTS_SERVICE_URL=https://payments.example.com \
  npx jest MoMo.e2e --no-coverage
```
