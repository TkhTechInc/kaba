# Spike: WhatsApp Business API (Meta Cloud API) Integration

**Date:** March 2026  
**Status:** Draft  
**Scope:** Integrate Meta WhatsApp Cloud API for invoice delivery, payment reminders, receipts, and debt reminders in Kaba.

---

## 1. Overview

### 1.1 Meta Cloud API vs On-Premises API

| Dimension | Cloud API | On-Premises API |
|-----------|-----------|-----------------|
| **Status** | Current, supported | **EOL October 23, 2025** |
| **Hosting** | Meta-hosted | Self-hosted |
| **Infrastructure** | No servers to run | Requires your own servers |
| **Updates** | Automatic | Final version v2.61.1; no new features since Jan 2024 |
| **Throughput** | Up to 1,000 msg/sec | 250 msg/sec |
| **Latency** | <5s p99 | Higher |
| **Uptime** | 99.9% SLA | Self-managed |

**On-Premises sunset timeline:**
- **January 9, 2024:** New feature updates stopped; only bug fixes
- **July 1, 2024:** New phone numbers could only register for Cloud API
- **October 23, 2025:** Final sunset — On-Premises client expired; messaging ceased

**Docs:** [On-Premises API Sunset](https://developers.facebook.com/docs/whatsapp/on-premises/sunset/)

### 1.2 Why Cloud API

- **No infrastructure** — Meta hosts everything; no servers, queues, or Redis to run
- **Lower cost** — Direct Meta billing; no BSP markup when using Cloud API directly
- **Security & compliance** — GDPR, LGPD, SOC2, SOC3 certified
- **Continuous innovation** — Cloud-only features; Meta invests in Cloud API only
- **Migration imperative** — On-Premises is EOL; Cloud API is the only supported path

---

## 2. Setup

### 2.1 Prerequisites

| Step | Description |
|------|-------------|
| 1 | Create a [Meta for Developers](https://developers.facebook.com/) account |
| 2 | Create a Meta App (Business type) |
| 3 | Add **WhatsApp** product to the app |
| 4 | Create or link a **WhatsApp Business Account** (WABA) |
| 5 | **Business verification** (required for production) — [Business Settings → Security Center](https://business.facebook.com/settings) |
| 6 | Add and verify a **phone number** (new or migrated from On-Prem) |
| 7 | Generate a **permanent system user access token** (store server-side only) |

### 2.2 Business Verification

Required for production sending at scale. Submit legal details and documents via **Business Settings → Security Center**. Unverified accounts have lower message limits.

### 2.3 Webhook Configuration

Your backend must expose an HTTPS endpoint for:

1. **Verification (GET)** — Meta sends `hub.mode`, `hub.challenge`, `hub.verify_token`. Respond with `hub.challenge` to verify ownership.
2. **Events (POST)** — Incoming messages, delivery receipts, read receipts, errors.

```typescript
// Webhook verification (GET)
// Meta calls: GET /webhooks/whatsapp?hub.mode=subscribe&hub.challenge=CHALLENGE&hub.verify_token=YOUR_TOKEN
// Respond with: 200 OK, body = hub.challenge

// Webhook events (POST)
// Meta sends: { object: "whatsapp_business_account", entry: [...] }
// Respond with: 200 OK immediately; process async
```

**Docs:** [Set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)

### 2.4 Environment Variables

```
WHATSAPP_PROVIDER=meta_cloud
WHATSAPP_META_ACCESS_TOKEN=<system_user_token>
WHATSAPP_META_PHONE_NUMBER_ID=<phone_number_id>
WHATSAPP_META_VERIFY_TOKEN=<webhook_verify_token>
WHATSAPP_META_BUSINESS_ACCOUNT_ID=<waba_id>   # optional, for multi-WABA
```

---

## 3. Pricing

### 3.1 Per-Message Model (Effective July 1, 2025)

WhatsApp transitioned from **per-conversation** to **per-message** billing worldwide.

| Category | Description | Cost |
|----------|-------------|------|
| **Service** | Replies within 24 hours of customer message | **Free** (unlimited) |
| **Utility** | Transactional (order confirmations, receipts, reminders) | Free in 24h window; $0.004–$0.0456/msg outside |
| **Authentication** | OTP, verification codes | $0.004–$0.0456/msg |
| **Marketing** | Promotional, product announcements | $0.025–$0.1365/msg (highest) |

### 3.2 Free Tier & Entry Points

- **Service conversations:** Unlimited free when replying within 24 hours of customer-initiated message
- **72-hour entry point:** Free for 72 hours after customer clicks ad or Facebook Page CTA
- **Marketing Messages Lite API:** Some free marketing message allowances — check [MM Lite API pricing](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/mm-lite-api-pricing) for current tier

### 3.3 West Africa Rates

Pricing varies by **recipient country code**. Nigeria, Ghana, Benin have specific rate tiers. Check Meta’s [official rate card](https://business.whatsapp.com/products/platform-pricing) for exact USD amounts. African markets typically have lower per-message rates than US/EU.

### 3.4 Our Use Cases → Category Mapping

| Use Case | Category | Notes |
|----------|----------|-------|
| Invoice sent | **Utility** | Transactional; use template `invoice_sent` |
| Payment reminder | **Utility** | Transactional; use template `payment_reminder` |
| Receipt sent | **Utility** | Transactional; use template `receipt_sent` |
| Debt reminder | **Utility** | Transactional; use template `debt_reminder` |
| Promotional offers | Marketing | Requires marketing template; higher cost |

**Recommendation:** Design all invoice/receipt/debt flows as **utility** templates to minimize cost and maximize approval likelihood.

---

## 4. Message Templates

### 4.1 Why Templates Are Required

**Outbound messages** (initiated by the business, outside the 24-hour service window) **must** use pre-approved message templates. Free-form text is only allowed when replying within 24 hours of a customer message.

### 4.2 Approval Process

1. Create template in Meta Business Manager or via [Message Templates API](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
2. Submit for review — automated screening, then human review if needed
3. Typical approval: 5 minutes to 2 hours; can take up to 48 hours
4. Use template name in API calls once approved

### 4.3 Template Categories

| Category | Use Case | Approval Strictness |
|----------|----------|---------------------|
| **Utility** | Order confirmations, receipts, reminders | Higher approval rate |
| **Authentication** | OTP only | Strict |
| **Marketing** | Promotions, offers | Most stringent |

### 4.4 Example Templates for Kaba

**invoice_sent (Utility)**
```
Hello {{1}},

Your invoice #{{2}} for {{3}} {{4}} is ready.

View and pay: {{5}}
```

**payment_reminder (Utility)**
```
Hi {{1}},

Reminder: Invoice #{{2}} for {{3}} {{4}} is due on {{5}}.

Pay here: {{6}}
```

**receipt_sent (Utility)**
```
Hi {{1}},

Your receipt for {{2}} is attached.

Thank you for your payment.
```

**debt_reminder (Utility)**
```
Hi {{1}},

Friendly reminder: You have an outstanding balance of {{2}} {{3}}.

Please settle at your earliest convenience.
```

### 4.5 Template Best Practices

- Variables must map to **real transaction data** (invoice ID, amount, date)
- Avoid variables at start/end of message
- No adjacent or non-sequential variables
- Use friendly tone; limit emojis (<10)
- No promotional language in utility templates

**Docs:** [Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)

---

## 5. West Africa Considerations

### 5.1 Opt-In & Compliance

WhatsApp enforces **strict opt-in**. Businesses may only contact users if:
- They have the recipient’s phone number
- They have **explicit opt-in** confirming the recipient wishes to receive messages

**Implications for Kaba:**
- Store opt-in status per customer (e.g. `customer.whatsappOptIn: boolean`)
- Collect opt-in during onboarding or when adding customer phone
- Provide opt-out mechanism (e.g. "Reply STOP to unsubscribe")
- Do **not** send invoices/receipts/debt reminders without recorded opt-in

**Docs:** [Getting opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/)

### 5.2 Phone Number Format (E.164)

All phone numbers must be in **E.164** format: `+[country code][subscriber number]`, no spaces or dashes.

| Country | Code | Example |
|---------|------|---------|
| Nigeria | +234 | +2348012345678 |
| Ghana | +233 | +233201234567 |
| Benin | +229 | +22990123456 |
| Côte d'Ivoire | +225 | +22507123456 |

Our `InvoiceService.normalizePhone()` already handles common Nigerian formats (e.g. `08012345678` → `+2348012345678`). Extend for Ghana (+233), Benin (+229), CI (+225) as needed.

### 5.3 Local Regulations

- **Nigeria:** NDPR (data protection); ensure consent and data handling comply
- **Ghana:** Data Protection Act 2012
- **Benin / CI:** Local data protection laws; align with fiscal (e-MECeF, FNE) practices

---

## 6. Integration Options

### 6.1 Direct Cloud API (Meta)

| Pros | Cons |
|------|------|
| Lowest cost — direct Meta billing | Self-manage everything |
| Full control over implementation | No managed support |
| No BSP markup | Must handle webhooks, retries, errors |
| Official, future-proof | Business verification on you |

**Endpoint:** `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`

### 6.2 Business Solution Providers (BSPs)

| BSP | Notes |
|-----|-------|
| **Twilio** | Higher cost; good for enterprises; managed support |
| **360dialog** | Transparent pricing; easy setup (~30 min); EU-based |
| **Infobip** | Global; strong in Africa |
| **MessageBird** | Multi-channel; WhatsApp + SMS |

| Pros | Cons |
|------|------|
| Managed support | BSP markup on Meta rates |
| Handles compliance/verification | Less control |
| Faster onboarding | Vendor lock-in |

### 6.3 Recommendation

**Direct Cloud API** for Kaba because:
1. **Cost** — MSMEs are price-sensitive; no BSP markup matters
2. **Control** — We already have `IWhatsAppProvider`; add `MetaCloudWhatsAppProvider`
3. **Simplicity** — One integration; no BSP account/sync
4. **Existing pattern** — We use direct integrations (KiKiaPay, MECeF, FNE)

---

## 7. Recommended Approach

### 7.1 Architecture

```
[DebtService / InvoiceService / ReceiptController]
         │
         ▼
   IWhatsAppProvider
         │
    ┌────┴────┐
    │         │
MockWhatsApp   MetaCloudWhatsAppProvider  ← NEW
    │         │
    │         └──► POST graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
```

### 7.2 Implementation Plan

1. **Add `MetaCloudWhatsAppProvider`** implementing `IWhatsAppProvider`
   - `send(phone, message)` → For 24h-window replies only; or map to utility template if outside
   - `sendMedia(phone, mediaUrl, caption)` → Use Cloud API document message type
   - Use templates for outbound (invoice, receipt, debt reminder)

2. **Template strategy**
   - Start with **interactive** or **document** messages where possible (e.g. send PDF with template caption)
   - Cloud API allows sending documents with `type: "document"` and `document.link`
   - For invoice/receipt: send PDF as document + template as caption

3. **Wire in `NotificationsModule`**
   - When `WHATSAPP_PROVIDER=meta_cloud` and token is set, instantiate `MetaCloudWhatsAppProvider`
   - Fallback to `MockWhatsAppProvider` when unconfigured

4. **Webhook endpoint**
   - Add `POST /webhooks/whatsapp` (or `/api/v1/webhooks/whatsapp`) for verification + events
   - Process delivery receipts, read receipts; optionally handle inbound replies for 24h window

5. **Opt-in storage**
   - Add `whatsappOptIn?: boolean` to Customer model
   - Check before sending; log/reject if not opted in

### 7.3 Cloud API Request Examples

**Send text (within 24h window):**
```json
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2348012345678",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Your invoice is ready. View: https://..."
  }
}
```

**Send document (invoice PDF):**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2348012345678",
  "type": "document",
  "document": {
    "link": "https://your-s3-presigned-url/invoice.pdf",
    "caption": "Invoice #INV-001 - NGN 50,000",
    "filename": "invoice-INV-001.pdf"
  }
}
```

**Send template (outbound, outside 24h):**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2348012345678",
  "type": "template",
  "template": {
    "name": "invoice_sent",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John" },
          { "type": "text", "text": "INV-001" },
          { "type": "text", "text": "NGN" },
          { "type": "text", "text": "50,000" },
          { "type": "text", "text": "https://pay.example.com/INV-001" }
        ]
      }
    ]
  }
}
```

**Docs:** [Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/)

### 7.4 Interface Compatibility

Our `IWhatsAppProvider` already has:
- `send(phone, message)` — Maps to text or template depending on context
- `sendMedia(phone, mediaUrl, caption)` — Maps to document/image message

`MetaCloudWhatsAppProvider` will:
- Normalize phone to E.164 (strip `+`, ensure country code)
- Use document message for `sendMedia` (PDF receipts, invoices)
- For `send` in outbound context: use utility template or fail if no template approved
- Return `{ success, messageId }` from Cloud API response

---

## 8. Open Questions & Risks

| # | Question/Risk | Priority | Owner |
|---|---------------|----------|-------|
| 1 | Template approval timeline — can we ship with mock and add templates in parallel? | MEDIUM | Backend |
| 2 | Document vs template for invoice — send PDF + template caption, or template with document component? | MEDIUM | Backend |
| 3 | Opt-in UX — where do we capture consent (onboarding, customer form, both)? | HIGH | Product |
| 4 | Multi-WABA — do we need one WABA per business or one shared? | MEDIUM | Infra |
| 5 | Webhook URL — must be HTTPS; Lambda + API Gateway or existing backend? | HIGH | Infra |
| 6 | Rate limits — Cloud API has throughput limits; do we need queue for bulk debt reminders? | MEDIUM | Backend |

---

## 9. Next Steps

1. **Create Meta App** — Register at [developers.facebook.com](https://developers.facebook.com); add WhatsApp product
2. **Business verification** — Start early; can take days/weeks
3. **Submit templates** — `invoice_sent`, `payment_reminder`, `receipt_sent`, `debt_reminder`
4. **Implement `MetaCloudWhatsAppProvider`** — Implement `IWhatsAppProvider`; call Cloud API
5. **Add webhook route** — Verification + event handling
6. **Add `customer.whatsappOptIn`** — Schema + UI for opt-in
7. **Wire NotificationsModule** — `WHATSAPP_PROVIDER=meta_cloud` → `MetaCloudWhatsAppProvider`
8. **Test** — Use Meta test number; verify invoice/receipt/debt flows

---

## 10. References

- [WhatsApp Cloud API – Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [On-Premises API Sunset](https://developers.facebook.com/docs/whatsapp/on-premises/sunset/)
- [Set up webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks/)
- [Send messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages/)
- [Message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
- [Getting opt-in](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in/)
- [WhatsApp Business Platform Pricing](https://business.whatsapp.com/products/platform-pricing)
- [Marketing Messages Lite API pricing](https://developers.facebook.com/docs/whatsapp/marketing-messages-lite-api/mm-lite-api-pricing)
