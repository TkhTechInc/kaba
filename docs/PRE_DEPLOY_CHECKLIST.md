# Pre-Deploy Checklist — Dev / Staging

Before pushing to dev for real testers, complete these items.

**Dev domain:** `dev.kabasika.com` (frontend) — configure in CDK deploy.

**Auth:** Email/password + Google OAuth only. SMS not used for now.

---

## 1. KkiaPay Webhook Setup (incl. ngrok for local)

### Architecture

- **KkiaPay** sends webhooks to **TKH Payments** (not to Kaba).
- **TKH Payments** receives webhooks → publishes to SNS → Kaba Lambda subscribes to SNS and marks invoices paid.
- Kaba does **not** receive KkiaPay webhooks directly when using TKH Payments.

### Deployed (dev/staging)

| Step | Action |
|------|--------|
| 1 | TKH Payments has a public URL (e.g. `https://xxx.execute-api.ca-central-1.amazonaws.com/dev/api/v1`) |
| 2 | In [KkiaPay dashboard](https://app.kkiapay.me) → Settings → Webhooks, set callback URL: `https://<TKH_PAYMENTS_BASE>/webhooks/kkiapay` (or whatever path TKH Payments expects) |
| 3 | Set `KKIAPAY_WEBHOOK_SECRET` in TKH Payments (for HMAC verification) — from KkiaPay dashboard |
| 4 | Kaba Lambda subscribes to SNS topic (`tkhtech-payment-events-dev`); CDK wires this |

**No ngrok needed** when TKH Payments and Kaba are deployed — both have public URLs.

### Local dev (TKH Payments running locally)

If TKH Payments runs on localhost, KkiaPay cannot reach it. Use **ngrok**:

| Step | Action |
|------|--------|
| 1 | Run ngrok: `ngrok http 3001` (or TKH Payments port) |
| 2 | Copy the ngrok URL, e.g. `https://abc123.ngrok.io` |
| 3 | In KkiaPay dashboard → Webhooks, set: `https://abc123.ngrok.io/api/v1/webhooks/kkiapay` (adjust path to match TKH Payments) |
| 4 | Set `API_URL` or base URL in TKH Payments to the ngrok URL so links/callbacks work |
| 5 | Restart TKH Payments; ngrok must stay running while testing |

**Note:** If TKH Payments is always deployed (not run locally), skip ngrok. Most setups use the deployed TKH Payments.

### Env vars (Kaba backend)

| Variable | Purpose |
|----------|---------|
| `PAYMENTS_SERVICE_URL` | TKH Payments base URL (required for payment links) |
| `TKH_PAYMENTS_API_KEY` | Optional; if TKH Payments requires auth |
| `KKIAPAY_PRIVATE_KEY` | Not used by Kaba when going through TKH Payments (TKH Payments has it) |
| `KKIAPAY_WEBHOOK_SECRET` | Not used by Kaba (TKH Payments verifies webhooks) |

### Env vars (frontend)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` | KkiaPay widget public key (sandbox for dev) |
| `NEXT_PUBLIC_KKIAPAY_SANDBOX` | `"true"` for dev, `"false"` for prod |

---

## 2. Google OAuth URIs (dev.kabasika.com)

For testers to sign in with Google on dev:

| Where | Value |
|-------|-------|
| **CDK deploy** | `-c frontendUrl=https://dev.kabasika.com` |
| **Google Cloud Console** → Credentials → OAuth client → **Authorized redirect URIs** | Add: `https://<API_GATEWAY_ID>.execute-api.ca-central-1.amazonaws.com/dev/api/v1/auth/google/callback` |
| **Google Cloud Console** → **Authorized JavaScript origins** | Add: `https://dev.kabasika.com` |

After deploy, get the API Gateway URL from AWS Console or CDK output, then add it to Google OAuth client. The backend redirects to `FRONTEND_URL/auth/callback` after OAuth — so `https://dev.kabasika.com/auth/callback` must be reachable.

---

## 3. UI Components — Wiring & Backend Fixes

Items to fix before pushing to dev:

### Profile picture (fixed)

- **Location:** `frontend/src/app/profile/page.tsx`
- **Fix:** Avatar container uses `overflow-hidden rounded-full`; Image uses `fill` + `object-cover object-center` so uploads (e.g. screenshots) are cropped to a circle instead of stretching.

### Notifications 404

- **Console:** `GET /api/v1/notifications?businessId=... 404`
- **Cause:** NotificationRepository uses `dynamodb.tableName` (or `kaba-dev`) — that table may not exist in CDK. Notifications module is wired; the table or config may need fixing.
- **Workaround:** Header notification bell will show "No notifications" or errors until fixed. Non-blocking for basic tester flow.

### Known from STABILIZATION.md

| Item | Location | Fix |
|------|----------|-----|
| **MECeF status on invoice detail** | `frontend/src/app/(home)/invoices/[id]/page.tsx` | After MECeF registers async, invoice detail doesn't auto-refresh to show DGI certification badge. Add polling or refresh button. |
| **Playwright e2e** | `frontend/e2e/*` | Run against dev server; fix any failures. |

### Voice button (Ledger page)

| Item | Details |
|------|---------|
| **Location** | `frontend/src/components/ui/VoiceEntryButton.tsx` — used on `/ledger` page |
| **Flow** | Mic → Web Speech API (or MediaRecorder + Whisper fallback) → `POST /api/v1/ai/voice-to-transaction` → LLM extracts transaction → creates ledger entry |
| **Backend** | `AIController.voiceToTransaction`, `VoiceToTransactionService` — requires `AI_VOICE_PROVIDER` (OpenRouter/LLM) and `AI_SPEECH_TO_TEXT` (Whisper for audio path) |
| **Feature** | `ai_voice` — enabled for all tiers |
| **Requirements** | `OPENROUTER_API_KEY` (or AI provider); `OPENAI_API_KEY` if using Whisper for audio fallback |
| **Potential issues** | (1) Currency defaults to XOF — ledger page does not pass `balance?.currency`; (2) If AI provider unset, backend returns error; (3) Whisper fallback needs `OPENAI_API_KEY` + `whisperEnabled` in env |

**Verify:** Click mic on Ledger page → speak "sold rice 5000" (or similar) → entry should appear. If "AI extraction failed", check OpenRouter/AI config.

---

### Likely wiring gaps (to verify)

| Component / Page | Check |
|------------------|-------|
| **Invoice detail** | Payment link, WhatsApp share, MECeF badge — all wired and working? |
| **POS terminal** | Share API, polling, cash button, receipt download — all working? |
| **Pay page** (`/pay/[token]`) | KkiaPay widget, MoMo form, redirect handling — working? |
| **Storefront** | Pay flow, KkiaPay/MoMo — working? |
| **Reconciliation** | SMS parsing (mock vs LLM) — UI shows results correctly? |
| **Receipts** | Upload, extraction, save — working? |
| **Trust score** | Share, benchmark — working? |
| **Webhooks settings** | Register, list, unregister — working? |
| **Branches** | Create org, create branch — working? |
| **Debts** | Create, remind — working? |
| **Suppliers** | Create, pay — working? |
| **Reports** | P&L, Cash Flow, consolidated — download PDF works? |
| **Admin** | Audit logs, features, businesses, AI query — working? |

### Feature-gated components

When a feature is not on the plan, the UI shows "not available on your plan". Ensure:

- `useFeatures` returns correct flags.
- No broken UI when feature is disabled (e.g. empty state, not a crash).

---

## 4. Pre-push verification

- [ ] `cd backend && npm run build && npm test`
- [ ] `cd frontend && npm run build && npm run type-check`
- [ ] Run `./scripts/run-live-kkiapay-test.sh` (or cash-flow E2E) against local dev
- [ ] Manually test: create invoice → share → pay page → KkiaPay (or cash)
- [ ] Manually test: POS → Collected cash → receipt download
- [ ] GitHub Actions CI green on PR

---

## 5. After deploy to dev

- [ ] Smoke test: login, dashboard, create invoice, POS
- [ ] Run KkiaPay live E2E against dev URLs (if secrets configured)
- [ ] Share dev URL + test account with QA
