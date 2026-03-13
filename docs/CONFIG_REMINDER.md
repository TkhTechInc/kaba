# Config Reminder

Quick reference for environment variables needed for common features. See `backend/.env.example` for full list.

## S3 Storage (Receipts, WhatsApp PDFs)

Requires S3 bucket with CORS for browser uploads.

```bash
S3_RECEIPTS_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ca-central-1  # or your region
```

**Receipt upload `net::ERR_FAILED`**: The bucket must allow CORS for `PUT` from your frontend origin. Example CORS config:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-app.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Send Invoice via WhatsApp

Uses the same S3 bucket. Also requires WhatsApp provider configured (`WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`, etc.).

## Payment Link / Generate Payment URL

Requires TKH Payments service reachable.

```bash
PAYMENTS_SERVICE_URL=https://payments.tkhtech.com/api/v1
# TKH_PAYMENTS_API_KEY=  # if the service requires auth
```

If TKH Payments is unreachable, you get `400: fetch failed` or `Failed to create payment link`.

## Trust Share URL

Trust score share links use the API base URL. Set `API_URL` to your backend's public URL:

```bash
# Production (e.g. kabasika.com)
API_URL=https://api.kabasika.com
```

Falls back to `APP_URL` or `http://localhost:3001` in dev.

## Invoice Share (POS / QR Code)

Uses `POST /api/v1/invoices/:id/share` with `{ businessId }` in the request body. No extra config beyond auth.

## Forgot Password / Email

By default `EMAIL_ENABLED=false`. The reset link is **logged to the backend console**, not sent by email.

**Dev workaround:** After submitting "Forgot password", check the terminal where `npm run dev` is running. You'll see:
```
[DEV] Password reset link for you@example.com: http://localhost:3000/auth/reset-password?token=abc123...
```
Copy that URL and open it in your browser to set a new password.

**To send real emails**, configure AWS SES (already set in .env):
1. Go to [AWS SES Console](https://ca-central-1.console.aws.amazon.com/ses/home?region=ca-central-1#/verified-identities)
2. Create identity → Email address → enter `lloydharold14@gmail.com` (or your AWS_SES_FROM)
3. Click the verification link sent to that inbox
4. In sandbox: also verify recipient emails you want to send to (e.g. same address for forgot-password)
5. AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) — same as DynamoDB/SNS

---

## Common 400 Causes

| Feature        | Error                                      | Fix                                              |
|----------------|--------------------------------------------|--------------------------------------------------|
| Send WhatsApp  | S3 storage is not configured for invoice PDFs | Set `S3_RECEIPTS_BUCKET` + AWS credentials       |
| Send WhatsApp  | Customer has no phone number               | Add phone to customer record                     |
| Send WhatsApp  | Invalid phone number format                | Use E.164 (e.g. +2348012345678)                  |
| Payment link   | fetch failed / Failed to create payment link | Configure `PAYMENTS_SERVICE_URL`; ensure service reachable |
| Share          | businessId must be a string                | Send `{ businessId }` in request body, not query |
