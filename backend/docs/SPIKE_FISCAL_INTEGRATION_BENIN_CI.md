# Spike: MECeF / e-MECeF (Benin) and FNE (Côte d'Ivoire) Fiscal Integration

**Date:** March 2026  
**Status:** Draft  
**Scope:** Understand compliance requirements, API mechanics, and integration approach for mandatory e-invoicing in Benin and Côte d'Ivoire.

---

## 1. Why This Matters

Both Benin and Côte d'Ivoire now mandate real-time fiscal certification of every invoice issued by a VAT-registered business. A customer of our SaaS who operates in either country **cannot legally issue invoices** without going through the respective government platform. This is a hard compliance blocker, not an optional feature.

---

## 2. Benin — e-MECeF (Système dématérialisé des Machines Électroniques Certifiées de Facturation)

### 2.1 Background

| Item | Detail |
|------|--------|
| Authority | Direction Générale des Impôts (DGI) |
| System name | e-MECeF (also called SyGMeF) |
| Mandate start | July 1, 2021 (VAT-registered businesses) |
| Scope | B2B, B2G; VAT-registered taxpayers |
| Format | JSON over REST |
| Tax ID required | IFU — 13-character unique fiscal identifier |
| Penalties | ≥ 1 000 000 FCFA per infraction; ≥ 2 000 000 on recurrence + 3-month admin closure |

### 2.2 Platform URLs

| Environment | Base URL |
|-------------|----------|
| Test (sandbox) | `https://developper.impots.bj` |
| Production | `https://sygmef.impots.bj` |

### 2.3 Authentication

JWT Bearer token. Each business (IFU) obtains a token through the DGI portal at [impots.bj](https://impots.bj). The token is passed as `Authorization: Bearer <token>` on every request.

```
Authorization: Bearer eyJhbGciOiJ...
Content-Type: application/json
Accept: application/json
```

### 2.4 API Flow (Clearance Model)

e-MECeF uses a **two-step clearance** model:

```
Step 1: POST /emcf/api/invoice/           → DGI assigns UID, calculates totals (real-time)
         ← {uid, nim, qrCode, ...}

Step 2: PUT  /emcf/api/invoice/{uid}/confirm   → finalise the invoice
     OR PUT  /emcf/api/invoice/{uid}/cancel    → reject/void (within ~2 min window)
```

> Test endpoints use prefix `/sygmef-emcf/api`; production uses `/emcf/api`.

### 2.5 Invoice POST Payload

```json
{
  "ifu": "3202200000001",
  "type": "FV",
  "client": {
    "name": "Acme SARL",
    "ifu": "3201900000042",
    "contact": "+22960000000",
    "address": "Cotonou, Bénin"
  },
  "operator": {
    "id": "EMP001",
    "name": "Koffi Jean"
  },
  "items": [
    {
      "name": "Consultation IT",
      "price": 100000,
      "quantity": 1,
      "taxGroup": "A"
    }
  ],
  "payment": [
    { "name": "ESPECES", "amount": 118000 }
  ],
  "aib": "A"
}
```

### 2.6 Invoice Types

| Code | Meaning |
|------|---------|
| `FV` | Facture Vente (sale invoice) |
| `FA` | Facture Avoir (credit note) — requires `reference` |
| `EV` | Avoir Externe Vente |
| `EA` | Avoir Externe Avoir |

### 2.7 Payment Types

`ESPECES` · `VIREMENT` · `CARTEBANCAIRE` · `MOBILEMONEY` · `CHEQUES` · `CREDIT` · `AUTRE`

### 2.8 Tax Groups

| Code | Rate |
|------|------|
| `A`  | 18% TVA standard |
| `B`  | Exempt / zero-rated |
| `C`  | Special rates (confirm via DGI reference data) |

Tax groups are dynamic — fetch via `GET /emcf/api/invoice/` to get live list.

### 2.9 Mandatory Invoice Fields (on printed/digital invoice)

- QR code (returned by DGI after certification)
- NIM — Numéro d'Identification de Machine (returned in response)
- Date & sequential invoice number
- Total HT, TVA amount, total TTC
- Supplier IFU + name + address
- Client IFU + name + address
- Itemised goods/services

### 2.10 Archiving

10 years (Benin Digital Code 2018).

---

## 3. Côte d'Ivoire — FNE (Facture Normalisée Électronique)

### 3.1 Background

| Item | Detail |
|------|--------|
| Authority | Direction Générale des Impôts (DGI) |
| System name | FNE — also covers RNE (Reçu Normalisé Électronique) for receipts |
| Platform | `https://services.fne.dgi.gouv.ci` |
| Registration opened | February 24, 2025 |
| Scope | All VAT-registered businesses; B2B, B2C, B2G, B2F |
| Format | REST API (JSON); also web portal, mobile app, payment terminals |

### 3.2 Rollout Timeline

| Date | Taxpayer regime |
|------|----------------|
| April 1, 2025 | RNI — Régime Normal d'Imposition (large enterprises) |
| June 1, 2025 | RSI — Régime Simplifié d'Imposition |
| August 1, 2025 | RME — Régime des Microentreprises |
| September 1, 2025 | TEE/TCE — State & municipal entrepreneurs |

### 3.3 Authentication

API key obtained by registering at [services.fne.dgi.gouv.ci](https://services.fne.dgi.gouv.ci). After registration, an API key is issued for use in all API requests. (The test sandbox registration is available on the same portal.)

### 3.4 API Flow (Pre-clearance / Real-time Clearance)

FNE uses a **pre-clearance** model — invoices must be validated by DGI **before** delivery to the customer:

```
Step 1: POST /api/invoices          → submit invoice data
         ← {invoiceId, fiscalNumber, qrCode, digitalSignature, status: "PENDING"}

Step 2: Polling or webhook          → wait for DGI validation
         ← {status: "CERTIFIED", nim, qrCode, ...}

Step 3: Deliver certified invoice to customer (with QR, NIM, fiscal number)
```

### 3.5 Issuance Channels

1. **API/ERP integration** — primary path for our SaaS
2. FNE web portal — for manual entry
3. FNE mobile app
4. Certified electronic payment terminals (for RNE receipts)

### 3.6 Mandatory Invoice Fields

- QR code (DGI-generated after certification)
- FNE visual identifier
- Unique fiscal number (NIM equivalent)
- Digital signature / electronic fiscal seal
- Serial numbering per DGI standard
- Supplier & customer identifiers (NCC — Numéro de Compte Contribuable)
- Itemised line items with VAT breakdown

### 3.7 Customer Identity (NCC Verification)

Côte d'Ivoire uses **NCC** (Numéro de Compte Contribuable) as the business tax ID. There is a public NCC verification endpoint:

```
GET https://services.fne.dgi.gouv.ci/en/ncc-verification?ncc={NCC}
```

### 3.8 Supported Models

| Model | Description |
|-------|-------------|
| B2B | Business to Business |
| B2C | Business to Consumer |
| B2G | Business to Government |
| B2F | Business to Franchise |

### 3.9 Exemptions

- Public utilities
- Airlines
- Banks / financial institutions
- Non-resident companies

### 3.10 Archiving

6 to 10 years depending on document type.

---

## 4. Comparison

| Dimension | Benin e-MECeF | Côte d'Ivoire FNE |
|-----------|--------------|-------------------|
| Tax ID | IFU (13 chars) | NCC |
| Auth | JWT Bearer (per-business) | API Key (per-business) |
| Model | 2-step clearance (POST → confirm/cancel) | Pre-clearance (POST → async status) |
| Timeout window | ~2 minutes to confirm/cancel | No strict cancel window (pending → certified) |
| Scope | VAT-registered only | All taxpayers (phased) |
| Sandbox | `developper.impots.bj` | `services.fne.dgi.gouv.ci` (same portal, test flag) |
| Format | JSON | JSON |
| Penalties | From 1M FCFA | Not yet published in detail |
| API maturity | Low (limited public docs) | Medium (portal available, partner SDKs emerging) |

---

## 5. Integration Architecture Proposal

### 5.1 Interface-First Design

Following our domain conventions, define an abstraction so country-specific adapters are swappable:

```typescript
// domains/fiscal/interfaces/IFiscalCertifier.ts

export interface IFiscalCertifier {
  /**
   * Submit an invoice for certification.
   * Returns a pending fiscal receipt with a tracking UID.
   */
  submitInvoice(invoice: FiscalInvoicePayload): Promise<FiscalSubmitResult>;

  /**
   * Confirm a pending invoice (e.g., after 2-step clearance).
   * Some implementations are fire-and-forget.
   */
  confirmInvoice(uid: string): Promise<FiscalCertifiedResult>;

  /**
   * Cancel/void a pending invoice within the allowed window.
   */
  cancelInvoice(uid: string): Promise<void>;

  /**
   * Fetch real-time reference data (tax groups, invoice types, etc.)
   */
  getReferenceData(): Promise<FiscalReferenceData>;
}
```

```typescript
// domains/fiscal/dto/fiscal.dto.ts

export interface FiscalInvoicePayload {
  businessIfu: string;               // IFU (Benin) or NCC (CI)
  invoiceType: 'SALE' | 'CREDIT_NOTE';
  reference?: string;                // For credit notes
  client: {
    name: string;
    taxId?: string;
    contact?: string;
    address?: string;
  };
  operator: {
    id: string;
    name: string;
  };
  items: FiscalLineItem[];
  payments: FiscalPayment[];
}

export interface FiscalLineItem {
  name: string;
  unitPrice: number;
  quantity: number;
  taxGroup: string;                  // 'A' = 18% TVA, 'B' = exempt, etc.
  originalPrice?: number;
  priceModification?: string;
}

export interface FiscalPayment {
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'MOBILE_MONEY' | 'CHEQUE' | 'CREDIT' | 'OTHER';
  amount: number;
}

export interface FiscalSubmitResult {
  uid: string;
  status: 'PENDING' | 'CERTIFIED';
  nim?: string;
  qrCode?: string;
  fiscalNumber?: string;
  digitalSignature?: string;
  rawResponse: unknown;
}

export interface FiscalCertifiedResult {
  uid: string;
  nim: string;
  qrCode: string;
  fiscalNumber: string;
  certifiedAt: string;
}
```

### 5.2 Adapters

```
domains/fiscal/
  interfaces/
    IFiscalCertifier.ts
  dto/
    fiscal.dto.ts
  adapters/
    BeninEmecefAdapter.ts      ← wraps e-MECeF API
    CoteDIvoireFneAdapter.ts   ← wraps FNE API
    MockFiscalCertifier.ts     ← for tests / countries not yet covered
  FiscalCertifierManager.ts   ← factory: businessId → correct adapter
  FiscalModule.ts
```

### 5.3 Benin Adapter Key Logic

```typescript
// BeninEmecefAdapter — key methods

async submitInvoice(payload: FiscalInvoicePayload): Promise<FiscalSubmitResult> {
  const body = this.mapToEmecefPayload(payload);
  const response = await this.http.post('/emcf/api/invoice/', body);
  // Returns uid, nim, qrCode etc.
  return this.mapResponse(response.data);
}

async confirmInvoice(uid: string): Promise<FiscalCertifiedResult> {
  // Must be called within ~2 minutes of submitInvoice
  const response = await this.http.put(`/emcf/api/invoice/${uid}/confirm`);
  return this.mapCertifiedResponse(response.data);
}

// Map our domain payment methods to e-MECeF codes
private mapPaymentMethod(method: FiscalPayment['method']): string {
  const map: Record<string, string> = {
    CASH: 'ESPECES',
    BANK_TRANSFER: 'VIREMENT',
    CARD: 'CARTEBANCAIRE',
    MOBILE_MONEY: 'MOBILEMONEY',
    CHEQUE: 'CHEQUES',
    CREDIT: 'CREDIT',
    OTHER: 'AUTRE',
  };
  return map[method];
}
```

### 5.4 Timing Constraint (Benin Critical Risk)

The 2-minute confirm/cancel window on e-MECeF is the **most dangerous operational risk**. 

Mitigation:
- **Confirm immediately** after a successful invoice POST — do not wait for user action
- Treat the confirm step as part of the atomic invoice creation flow (not a background job)
- Implement a dead-letter queue for unconfirmed UIDs, with a reconciliation cron that cancels stale pending invoices before the window closes

### 5.5 FiscalCertifierManager (Factory)

```typescript
// Resolves correct certifier by business country/config
@Injectable()
export class FiscalCertifierManager {
  constructor(
    @Inject('BENIN_CERTIFIER') private benin: IFiscalCertifier,
    @Inject('CI_CERTIFIER') private ci: IFiscalCertifier,
    @Inject('MOCK_CERTIFIER') private mock: IFiscalCertifier,
  ) {}

  forBusiness(business: Business): IFiscalCertifier {
    switch (business.country) {
      case 'BJ': return this.benin;
      case 'CI': return this.ci;
      default:   return this.mock;
    }
  }
}
```

---

## 6. Invoice Service Integration Point

The `InvoiceService` (Agent 3 workstream) should call the certifier **at finalization time**:

```typescript
async finalizeInvoice(invoiceId: string, businessId: string): Promise<Invoice> {
  const invoice = await this.invoiceRepo.findById(invoiceId, businessId);
  const business = await this.businessRepo.findById(businessId);
  
  const certifier = this.fiscalManager.forBusiness(business);
  const payload = this.toFiscalPayload(invoice, business);
  
  const submitResult = await certifier.submitInvoice(payload);
  const certified = await certifier.confirmInvoice(submitResult.uid);
  
  invoice.fiscalNumber = certified.fiscalNumber;
  invoice.nim = certified.nim;
  invoice.qrCode = certified.qrCode;
  invoice.status = InvoiceStatus.CERTIFIED;
  
  return this.invoiceRepo.save(invoice);
}
```

---

## 7. Open Questions & Risks

| # | Question/Risk | Priority | Owner |
|---|---------------|----------|-------|
| 1 | Benin e-MECeF: How is the JWT token obtained? Is it per-business or per-platform? Does it expire? | HIGH | Backend |
| 2 | Côte d'Ivoire FNE: Exact API schema/field names for the POST request (not yet publicly documented) | HIGH | Backend |
| 3 | Does our SaaS need to be **DGI-approved** as a certified SFE (Système de Facturation Électronique) before customers can use it? | CRITICAL | Legal/Compliance |
| 4 | Benin 2-minute confirm window: can we always confirm synchronously, or are there cases (e.g., offline) requiring cancellation flows? | HIGH | Backend |
| 5 | Côte d'Ivoire FNE: Is the certification synchronous or always async with polling? What is the SLA? | MEDIUM | Backend |
| 6 | Token/credential storage per business — needs secure per-tenant credential vault | HIGH | Infra |
| 7 | How to handle DGI API downtime? Can invoices be queued and submitted later? What is the legal grace period? | HIGH | Backend |
| 8 | Are there SaaS intermediary (third-party integrator) licensing requirements in Benin or CI? | CRITICAL | Legal |

---

## 8. Third-Party Middleware Options (if direct integration is too complex)

If DGI approval as a certified SFE is time-consuming, we can route through a certified middleware:

| Provider | Countries | Notes |
|----------|-----------|-------|
| [Dexy Africa](https://dexyafrica.com) | Benin, Côte d'Ivoire | Supports Sage, Odoo, Dynamics, Excel; local support |
| [FNEBridge (Osiris CI)](https://groupeosiris-ci.com/fne-bridge/) | Côte d'Ivoire | DGI-approved API bridge, supports Docker |
| EDICOM | Both | Enterprise-grade; likely overkill/expensive for MSMEs |

Trade-off: Middleware adds cost + dependency but may significantly shorten time-to-market and avoids the DGI approval bottleneck.

---

## 9. Implementation Status (March 2026)

The following has been implemented:

- **BeninEmecefAdapter** — Real e-MECeF API client. Uses `MECEF_BENIN_JWT` and `MECEF_BENIN_BASE_URL`. Falls back to `StubMECeFProvider` when JWT is unset.
- **CoteDIvoireFneAdapter** — Real FNE API client. Uses `FNE_CI_API_KEY` and `FNE_CI_BASE_URL`. Falls back to `StubFNEProvider` when API key is unset.
- **Business.taxId** — IFU (Benin) or NCC (Côte d'Ivoire) stored on Business; collected during onboarding.
- **InvoiceService** — Auto-registers with MECeF (BJ) or FNE (CI) when invoice is created (non-pending). Uses `business.taxId` for IFU when available.
- **Configuration** — `fiscal.mecefBeninJwt`, `fiscal.mecefBeninBaseUrl`, `fiscal.fneCiApiKey`, `fiscal.fneCiBaseUrl` in `configuration.ts` and `.env.example`.

## 10. Next Steps

1. **Register on both sandboxes**
   - Benin: [developper.impots.bj](https://developper.impots.bj) — get test JWT token
   - Côte d'Ivoire: [services.fne.dgi.gouv.ci](https://services.fne.dgi.gouv.ci) — get test API key

2. **Clarify SFE approval requirement** — email DGI Benin and DGI CI to ask whether our SaaS needs to register as a certified SFE operator

3. **Prototype `BeninEmecefAdapter`** — use the sandbox; verify the 2-step confirm flow end-to-end

4. **Prototype `CoteDIvoireFneAdapter`** — submit a minimal invoice via FNE test environment, capture full response schema

5. **Define `IFiscalCertifier`** interface and wire into `FiscalModule` (can be done in parallel with prototyping)

6. **Decide: build direct or use middleware** — deadline: before any customer goes live in BJ or CI

---

## 11. Phase 3: Third-Party Fiscal API / SDK Product (Roadmap)

Once our SFE is DGI-approved, we can offer an **API and SDK** that other software vendors (ERPs, POS, custom apps) use to certify invoices without each needing their own approval. This is the model used by [Dexy Africa](https://dexyafrica.com) and [FNEBridge](https://groupeosiris-ci.com/fne-bridge/).

### Prerequisites

| Prerequisite | Status |
|--------------|--------|
| Benin e-MECeF SFE approved by DGI | Pending |
| Côte d'Ivoire FNE API approved (if applicable) | Pending |
| Production credentials and operational flow | After Phase 1–2 |

### Deliverables

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | **Public REST API** | `/api/v1/fiscal/certify` — accept invoice payload, return certified QR + fiscal serial. Multi-tenant by API key. |
| 2 | **SDK (JavaScript/TypeScript)** | `@tkhtech/fiscal-sdk` — npm package for Node/React apps. |
| 3 | **SDK (PHP)** | For Sage, Odoo, and legacy PHP integrations. |
| 4 | **Webhook / async callback** | For FNE (CI) when certification is async; notify client when certified. |
| 5 | **Developer portal** | Sign-up, API key management, usage docs, sandbox. |
| 6 | **Pricing & billing** | Per-certification or per-tenant pricing; usage tracking. |

### API Design (Draft)

```
POST /api/v1/fiscal/certify
Authorization: Bearer <client_api_key>
Content-Type: application/json

{
  "country": "BJ" | "CI",
  "invoiceType": "sale" | "credit_note",
  "supplier": { "taxId": "3202200000001", "name": "...", "address": "..." },
  "customer": { "taxId": "3201900000042", "name": "...", "address": "..." },
  "items": [
    { "description": "...", "quantity": 1, "unitPrice": 10000, "taxGroup": "A" }
  ],
  "payments": [{ "method": "CASH", "amount": 11800 }],
  "reference": "INV-2026-001"  // optional, for credit notes
}

→ 200 OK
{
  "certified": true,
  "fiscalNumber": "BJ-FNE-...",
  "qrCode": "data:image/png;base64,...",
  "certifiedAt": "2026-03-04T12:00:00Z"
}
```

### Architecture

```
[Client ERP] → [Our API] → [BeninEmecefAdapter / CoteDIvoireFneAdapter] → [DGI e-MECeF / FNE]
```

- Each client gets an API key (per tenant or per integration).
- Client credentials (IFU/NCC, JWT) per end-user business: stored in our vault, keyed by client API key + business tax ID.
- Rate limiting, audit logging, and SLA monitoring.

### Risks & Open Questions

| # | Risk / Question | Mitigation |
|---|-----------------|------------|
| 1 | DGI may require separate approval for third-party API vs direct SFE | Clarify with DGI before build |
| 2 | Liability if client misuses API or certifies invalid invoices | Terms of service, API usage limits, audit trail |
| 3 | Per-business credentials: clients must onboard each end-user with IFU/NCC | Developer docs, onboarding flow, credential vault |

### Suggested Timeline

| Phase | Duration | Focus |
|-------|----------|-------|
| 3a | 2–3 weeks | Public REST API + API key auth |
| 3b | 2 weeks | JS/TS SDK |
| 3c | 2 weeks | Developer portal (sign-up, docs, sandbox) |
| 3d | 1–2 weeks | PHP SDK (if demand) |
| 3e | Ongoing | Pricing, billing, support |

---

## 12. References

- Benin e-MECeF platform: https://sygmef.impots.bj
- Benin DGI portal: https://impots.bj
- `freemecef` PHP reference implementation: https://github.com/akamstar/freemecef
- Côte d'Ivoire FNE platform: https://services.fne.dgi.gouv.ci
- Dexy Africa (middleware): https://dexyafrica.com
- FNEBridge by Osiris: https://groupeosiris-ci.com/fne-bridge
- EDICOM Benin guide: https://edicomgroup.com/electronic-invoicing/benin
- VATUpdate CI reform: https://vatupdate.com (search "Ivory Coast FNE 2025")
