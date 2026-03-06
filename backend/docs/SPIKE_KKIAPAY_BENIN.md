# Spike: KiKiaPay Integration for Benin

**Purpose:** Document KiKiaPay capabilities for Benin (primary launch country) and align our payment link flow with their offering.

## KiKiaPay Overview

KiKiaPay is a payment aggregator for West Africa (Benin, Togo, Ivory Coast, Senegal, Mali, Niger, Burkina Faso). It supports:

- **Mobile Money:** MTN MoMo, Moov Money, Celtiis Cash, Orange Money, Free Money, T-Money
- **Wave**
- **Cards:** Visa, Mastercard

**Docs:** https://docs.kkiapay.me/

## Integration Options

### 1. Web Widget (Client-side)

Embedded widget for inline payment on your site:

```html
<script src="https://cdn.kkiapay.me/k.js"></script>
<kkiapay-widget
  amount="<amount>"
  key="<api-key>"
  url="<logo-url>"
  position="center"
  sandbox="true"
  callback="<success-redirect-url>"
  data="">
</kkiapay-widget>
```

- **Flow:** User pays on-page; redirect on success
- **Use case:** Checkout page, single payment
- **No phone required** — user chooses payment method in the widget

### 2. REST API – Request Payment (Server-side)

Our current `KkiaPayGateway` uses this:

- **Endpoint:** `POST /api/v1/transactions/request-payment`
- **Requires:** `customer_phone_number` — KiKiaPay sends a push to the customer’s phone
- **Flow:** Backend initiates → customer approves on phone → webhook confirms
- **Limitation:** We need the customer’s phone number; no generic “payment link” URL

### 3. JavaScript SDK

- WebComponent, CSS class, or direct JS
- Similar to widget — on-page payment, no redirect to KiKiaPay hosted page

## Current Implementation vs. “Payment Link”

Our `generatePaymentLink` API expects a **URL** the user can share (e.g. Stripe Checkout). KiKiaPay’s request-payment API does **not** return a URL; it triggers a push to the customer’s phone.

**Gap:** For Benin (XOF), we cannot generate a shareable link without either:

1. **Widget/SDK flow:** Merchant embeds the widget; customer pays on the merchant’s page. No shareable link.
2. **Hosted page (if available):** KiKiaPay may offer a hosted payment page URL — needs verification in their docs.
3. **Request-payment + phone:** We have the customer’s phone; we call the API and the customer gets a push. No link to share.

## Recommendations for Benin Testing

1. **Use widget for web checkout:** When the user clicks “Payment link” on an invoice, instead of redirecting to a URL, open a modal/side panel with the KiKiaPay widget pre-filled with amount and currency. The customer pays there.

2. **Use request-payment when we have phone:** If the customer has a phone number in our DB, we can call the request-payment API and show “Payment request sent to customer’s phone.” No link.

3. **Verify hosted payment page:** Check KiKiaPay docs for a hosted payment page URL (e.g. `https://pay.kkiapay.me/...`) that we could use as a shareable link.

## Environment Variables

- `KKIAPAY_PRIVATE_KEY` — API key from https://app.kkiapay.me/dashboard
- `KKIAPAY_WEBHOOK_SECRET` — For webhook signature verification
- `KKIAPAY_BASE_URL` — Default: `https://api.kkiapay.me`
- `KKIAPAY_SANDBOX` — Set to `true` when using widget sandbox; 404 from status API is trusted as success

## Testing Failed Transactions

When testing failed payments (e.g. KkiaPay test numbers for "Insufficient fund", "Payment declined"):

1. **If KkiaPay adds status to the redirect URL** — We read `transaction_status`, `status`, or `event` from the URL and reject when it indicates failure.
2. **Manual override** — Add `?transaction_status=failed` to the return URL to simulate a failed redirect, e.g.:
   ```
   http://localhost:3000/pay/kkiapay-return?token=XXX&transaction_id=YYY&transaction_status=failed
   ```
   The backend will reject and show "Payment was not successful" without calling the KkiaPay API.

## Next Steps

1. Confirm with KiKiaPay docs whether a hosted payment page URL exists.
2. If yes: extend `KkiaPayGateway.createPaymentIntent` to return that URL when no phone is provided.
3. If no: implement widget flow on the frontend for “Payment link” when the gateway is KiKiaPay.
4. Test with sandbox: `sandbox="true"` in the widget.
