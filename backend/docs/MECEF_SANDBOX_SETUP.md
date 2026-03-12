# MECeF Sandbox Setup (Benin e-MECeF)

Use this guide to connect Kaba to the Benin DGI e-MECeF sandbox for invoice certification testing.

## Prerequisites

- Sandbox account at [developper.impots.bj](https://developper.impots.bj)
- JWT (Bearer token) from the DGI developer portal
- Test IFU (13-character fiscal ID) — the sandbox may provide a test IFU or use your registered one

## 1. Configure Environment

Add to `backend/.env`:

```bash
# Benin e-MECeF sandbox
MECEF_BENIN_JWT=your_jwt_token_from_developper_impots_bj
MECEF_BENIN_BASE_URL=https://developper.impots.bj
```

- **MECEF_BENIN_JWT** — Required. Obtain from the DGI developer portal. Without it, the app uses `StubMECeFProvider` (no real API calls).
- **MECEF_BENIN_BASE_URL** — Optional. Defaults to `https://developper.impots.bj` for sandbox. Use `https://sygmef.impots.bj` for production.

## 2. Verify Sandbox Connection

Run the sandbox test script:

```bash
cd backend
MECEF_BENIN_JWT=your_jwt npm run mecef:sandbox-test
```

This script:
1. Calls `GET /sygmef-emcf/api/info/status` to check API availability
2. Registers a minimal test invoice
3. Confirms the invoice within the 120-second window
4. Prints the returned QR code and fiscal serial (NIM)

## 3. Business Configuration

For MECeF to run on real invoices, the business must have:

- **countryCode**: `BJ`
- **taxId**: Valid IFU (13 digits, e.g. `3202200000001`)

Set these during onboarding or via the business settings. The InvoiceService only calls MECeF when `business.countryCode === 'BJ'` and `mecefProvider.getSupportedCountries()` includes `BJ`.

## 4. API Flow

e-MECeF uses a two-step clearance model:

| Step | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| 1 | POST | `/sygmef-emcf/api/invoice` | Register invoice → DGI returns `uid` (2-min window) |
| 2 | PUT | `/sygmef-emcf/api/invoice/{uid}/confirm` | Confirm → DGI returns QR code + fiscal serial |
| 2 alt | PUT | `/sygmef-emcf/api/invoice/{uid}/cancel` | Reject/void within window |

Production uses `/emcf/api` instead of `/sygmef-emcf/api`.

## 5. Manual API Test (Tax Controller)

With the backend running and a valid JWT:

```bash
# 1. Get auth token (login first)
TOKEN="your_kaba_jwt"

# 2. Register invoice with MECeF
curl -X POST http://localhost:3001/api/v1/tax/mecef/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nim": "APP-TEST001",
    "ifu": "3202200000001",
    "montant_ht": 10000,
    "montant_tva": 1800,
    "montant_ttc": 11800,
    "type_facture": "FV",
    "date": "2026-03-10",
    "items": [{"nom": "Test item", "quantite": 1, "prix_unitaire_ht": 10000, "montant_ht": 10000, "montant_tva": 1800, "montant_ttc": 11800}]
  }'

# 3. Confirm (use uid from step 2, within 120 seconds)
curl -X POST http://localhost:3001/api/v1/tax/mecef/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "UID_FROM_STEP_2", "decision": "confirm"}'
```

## 6. Invoice Creation Flow

When an invoice is created for a Benin business (and MECeF is configured):

1. `InvoiceService.create()` creates the invoice
2. `registerWithMECeF()` is called in the background
3. DGI returns a temporary `uid` → stored as `mecefToken`
4. After ~2 seconds, `confirmInvoice()` is called
5. DGI returns QR code + NIM → stored as `mecefQrCode`, `mecefSerialNumber`
6. Invoice status: `mecefStatus` = `confirmed`

## 7. References

- [e-MECeF SDK (developper.impots.bj)](https://developper.impots.bj/sygmef-emcf/authorized/Sdk.html)
- [SPIKE_FISCAL_INTEGRATION_BENIN_CI.md](./SPIKE_FISCAL_INTEGRATION_BENIN_CI.md) — full spike doc
- [freemecef PHP reference](https://github.com/akamstar/freemecef)
