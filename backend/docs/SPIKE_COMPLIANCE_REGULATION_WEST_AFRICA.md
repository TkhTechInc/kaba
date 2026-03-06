# Spike: Compliance and Regulation — MSME Accounting SaaS in West Africa

**Date:** March 2026  
**Status:** Draft  
**Scope:** Map compliance and regulatory requirements for our Kaba MSME accounting SaaS operating in West Africa. Provide a clear action plan.

---

## 1. Executive Summary

Our product (ledger, invoicing, customers, receipts, tax, AI) touches **four regulatory domains** in West Africa:

| Domain | Risk Level | Status |
|--------|------------|--------|
| **Fiscal / E-invoicing** | CRITICAL | Benin & CI covered by [SPIKE_FISCAL_INTEGRATION_BENIN_CI.md](./SPIKE_FISCAL_INTEGRATION_BENIN_CI.md); Nigeria (NRS) coming 2026–2027 |
| **Data Protection** | HIGH | NDPA (NG), Ghana DPA, ECOWAS; partial implementation exists |
| **Payment Services** | MEDIUM | UEMOA Instruction 2024 if we aggregate/initiate payments |
| **Business Licensing** | LOW–MEDIUM | CAC (NG), GRA, DGI; country-specific |

**Key finding:** We are **not** a payment institution if we only record transactions and generate payment links that redirect to third-party gateways (Paystack, Flutterwave, etc.). We **are** subject to data protection and fiscal certification in every market we serve.

---

## 2. Regulatory Landscape by Domain

### 2.1 Fiscal / E-Invoicing (CRITICAL)

Mandatory real-time fiscal certification of invoices is a **hard compliance blocker** in multiple countries. Customers cannot legally issue invoices without going through government platforms.

| Country | System | Authority | Status |
|---------|--------|-----------|--------|
| **Benin** | e-MECeF (SyGMeF) | DGI | Live since July 2021 |
| **Côte d'Ivoire** | FNE | DGI | Phased rollout 2025 |
| **Nigeria** | NRS MBS (Merchant Buyer Solution) | NRS (ex-FIRS) | Phased 2025–2028 |

**Nigeria NRS E-Invoicing Timeline (2026–2028):**

| Segment | Turnover | Go-Live | Enforcement |
|---------|----------|---------|-------------|
| Large | ₦5B+ | Nov 2025 | Apr 2026 |
| Medium | ₦1B–₦5B | Jul 2026 | Jan 2027 |
| Emerging (MSME) | <₦1B | Jul 2027 | Early 2028 |

**Penalties (Nigeria):** ₦200,000 + 100% of tax due + interest (CBN rate).  
**Penalties (Benin):** ≥1M FCFA per infraction; ≥2M on recurrence + 3-month admin closure.

**Open questions (from fiscal spike):**
- Does our SaaS need **DGI-approved SFE** (Système de Facturation Électronique) certification before customers can use it?
- Are there **SaaS intermediary licensing** requirements in Benin or Côte d'Ivoire?

---

### 2.2 Data Protection (HIGH)

Every West African market we serve has data protection laws. We process PII (customers, users, business data) and must comply.

| Country | Framework | Authority | Key Requirements |
|---------|------------|-----------|------------------|
| **Nigeria** | NDPA 2023 | NDPC | DCMI/DPMI registration if "major importance"; consent, security, breach notification |
| **Ghana** | Data Protection Act 2012; Bill 2025 | DPC | Registration, DPO, policies, breach notification |
| **Benin** | Digital Code 2018 | APDP | GDPR-like; fines up to XOF 50M |
| **Côte d'Ivoire** | Law 2013-450 | ARTCI | Consent; sensitive data needs prior authorization |
| **Senegal** | Law 2008-12 | CDP | Access, correction, objection rights |
| **ECOWAS** | Supplementary Act 2010 (revised 2024) | National DPAs | Harmonized baseline; consent, lawful processing |

**Nigeria NDPA 2023 — DCMI/DPMI Registration (Section 44):**

Organizations that qualify as **Data Controllers/Processors of Major Importance** must register with NDPC. Criteria include:
- Nature and volume of personal data
- Purpose of processing
- Number of Nigerian data subjects
- Value/significance to economy, society, or security

**Action:** Assess whether we qualify as DCMI/DPMI. SaaS with many Nigerian MSMEs likely does.

**What we already have:**
- `ComplianceService` — data export (portability), erasure (right to be forgotten)
- `RegionalCompliance` — NDPR, Ghana DPA, ECOWAS stubs
- Audit logging for compliance events
- Soft-delete for erasure; anonymization for customers

**Gaps:**
- Consent management (explicit consent capture, withdrawal)
- Breach notification procedures
- DCMI/DPMI registration (Nigeria)
- Ghana DPC registration
- Retention periods vary by country (we use 2555 days ≈ 7 years; some require 6–10)

---

### 2.3 Payment Services (MEDIUM — Conditional)

**UEMOA Instruction n°001-01-2024** (Jan 2024) regulates payment service providers in Benin, Burkina Faso, Guinea-Bissau, Côte d'Ivoire, Mali, Niger, Senegal, Togo.

**We are likely NOT a payment institution if:**
- We only **record** payment transactions (ledger entries)
- We generate **payment links** that redirect to Paystack, Flutterwave, Orange Money, MTN MoMo, etc.
- We do **not** hold customer funds, aggregate accounts, or initiate payments from customer accounts

**We WOULD need licensing if:**
- We aggregate payments across multiple providers
- We initiate payments from customer bank/mobile money accounts
- We hold or transmit funds on behalf of customers

**Action:** Confirm with legal counsel. Our current design (payment links → third-party gateway) should keep us outside payment institution scope. Document this in a compliance memo.

---

### 2.4 Business & Tax Licensing (LOW–MEDIUM)

| Country | Registration | Tax | Notes |
|---------|--------------|-----|-------|
| **Nigeria** | CAC (Corporate Affairs Commission) | FIRS/NRS, VAT | Nigeria Startup Act benefits if eligible |
| **Ghana** | Registrar General, GIPC (foreign) | GRA | VAT registration if turnover threshold |
| **Benin / CI / UEMOA** | Local company registration | DGI | May need local entity for fiscal integration |

**Action:** Ensure TKH-TECH (or operating entity) is properly registered in each jurisdiction where we have paying customers. Consider local subsidiary if required for fiscal/SFE certification.

---

## 3. Country-by-Country Compliance Checklist

### Nigeria
- [ ] NDPA: Assess DCMI/DPMI; register with NDPC if required
- [ ] NDPA: Consent flows, breach notification process
- [ ] NRS: Prepare for e-invoicing (MBS) — MSME go-live Jul 2027
- [ ] CAC: Company registration
- [ ] Tax: VAT, company income tax

### Ghana
- [ ] Ghana DPA: Register with DPC; appoint DPO if required
- [ ] GRA: VAT invoice compliance (multi-currency, local standards)
- [ ] Company registration

### Benin
- [ ] e-MECeF: SFE certification (clarify with DGI)
- [ ] APDP: Data protection (Digital Code 2018)
- [ ] Fiscal integration: Implemented (see fiscal spike)

### Côte d'Ivoire
- [ ] FNE: SFE/API approval (clarify with DGI)
- [ ] ARTCI: Data protection (Law 2013-450)
- [ ] Fiscal integration: Implemented (see fiscal spike)

### Senegal
- [ ] CDP: Data protection (Law 2008-12)
- [ ] Fiscal: Check if e-invoicing mandate exists or is planned

### Other UEMOA (Mali, Niger, Burkina Faso, Togo, Guinea-Bissau)
- [ ] Data protection: National laws (often ECOWAS-implementing)
- [ ] Fiscal: Monitor for e-invoicing mandates
- [ ] UEMOA payment instruction: Confirm we are out of scope

---

## 4. Action Plan

### Phase 1: Immediate (0–4 weeks)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | **Clarify SFE certification** — Email DGI Benin and DGI Côte d'Ivoire: Does our SaaS need to register as a certified SFE? What is the process? | Legal/Compliance | CRITICAL |
| 2 | **Nigeria DCMI/DPMI assessment** — Review NDPC guidance; determine if we qualify; begin registration if yes | Legal/Compliance | HIGH |
| 3 | **Consent management** — Add explicit consent capture at sign-up; consent withdrawal flow; log consent events | Backend | HIGH |
| 4 | **Breach notification procedure** — Document process (detect → assess → notify DPA + data subjects within required timeframe) | Compliance | HIGH |

### Phase 2: Short-Term (1–3 months)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 5 | **Ghana DPC registration** — If we have/have Ghana customers, register with Data Protection Commission | Legal | HIGH |
| 6 | **Nigeria NRS e-invoicing prep** — Research MBS API, Access Point Provider (APP) requirements; design `NigeriaNrsAdapter` (interface-first) | Backend | HIGH |
| 7 | **Retention policy by country** — Align `auditRetentionDays` and invoice/ledger retention with each country (6–10 years typical) | Backend | MEDIUM |
| 8 | **Payment services legal opinion** — Get written confirmation we are not a payment institution under UEMOA Instruction | Legal | MEDIUM |

### Phase 3: Medium-Term (3–6 months)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 9 | **Nigeria NRS adapter** — Implement when MBS API is available; integrate into `FiscalCertifierManager` | Backend | HIGH |
| 10 | **Benin/CI SFE certification** — Complete process if required; or adopt middleware (Dexy, FNEBridge) as interim | Legal/Backend | CRITICAL |
| 11 | **Privacy policy & terms** — Country-specific annexes for NDPA, Ghana DPA, Benin, CI; consent language | Legal | MEDIUM |
| 12 | **Compliance dashboard** — Internal view: registration status, retention config, last audit per country | Product | LOW |

### Phase 4: Ongoing

| # | Action | Owner |
|---|--------|-------|
| 13 | **Regulatory monitoring** — Senegal, Mali, Niger, Burkina Faso, Togo: e-invoicing mandates; data law updates | Compliance |
| 14 | **ECOWAS Act revision** — Track 2024 revised Supplementary Act; align policies when ratified | Compliance |
| 15 | **Annual compliance review** — Re-assess DCMI/DPMI, retention, consent flows | Compliance |

---

## 5. Technical Recommendations

### 5.1 Consent Management

```typescript
// domains/compliance/interfaces/IConsentManager.ts

export interface ConsentRecord {
  businessId: string;
  userId: string;
  purpose: string;           // 'marketing' | 'service' | 'analytics' | 'fiscal'
  grantedAt: string;
  withdrawnAt?: string;
  version: string;           // policy version at consent time
}

export interface IConsentManager {
  recordConsent(record: ConsentRecord): Promise<void>;
  withdrawConsent(businessId: string, userId: string, purpose: string): Promise<void>;
  hasConsent(businessId: string, userId: string, purpose: string): Promise<boolean>;
}
```

### 5.2 Breach Notification

- Define severity levels (e.g., PII exposed vs. full DB leak)
- Map notification deadlines by country (e.g., NDPA: "without undue delay"; Ghana: 72 hours in some cases)
- Implement `ComplianceService.notifyBreach(incident)` that logs and triggers external notification workflow

### 5.3 Regional Compliance Expansion

Expand `RegionalCompliance.ts` with country-specific retention and consent rules:

```typescript
// Add: Benin (Digital Code), CI (Law 2013-450), Senegal (Law 2008-12)
// Retention: 6–10 years for fiscal/tax docs; 2555 days (7y) for NDPR
// Sensitive data: CI requires ARTCI authorization
```

---

## 6. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SFE certification required but not obtained | Medium | Critical | Clarify with DGI; use middleware (Dexy, FNEBridge) as bridge |
| NDPC fines for unregistered DCMI | Medium | High | Complete DCMI assessment and register |
| NRS e-invoicing non-compliance (2027+) | High | Critical | Build Nigeria adapter; pilot before enforcement |
| Data breach without notification | Low | High | Implement breach procedure; test annually |
| Misclassified as payment institution | Low | High | Legal opinion; document architecture |
| Ghana DPA non-registration | Medium | Medium | Register when Ghana customers exist |

---

## 7. References

- [SPIKE_FISCAL_INTEGRATION_BENIN_CI.md](./SPIKE_FISCAL_INTEGRATION_BENIN_CI.md) — e-MECeF, FNE
- Nigeria Data Protection Act 2023 (NDPA)
- Nigeria Data Protection Commission: https://ndpc.gov.ng
- Ghana Data Protection Commission: https://dataprotection.org.gh
- ECOWAS Supplementary Act on Personal Data Protection (2010, revised 2024)
- UEMOA Instruction n°001-01-2024 (payment services)
- Benin Digital Code 2018
- Côte d'Ivoire Law 2013-450 (data protection)
- Nigeria NRS e-invoicing: Businessday, Vi-M, NRS announcements

---

## 8. Summary: What We Should Do

1. **Clarify SFE certification** with DGI Benin and CI — blocking question for fiscal integration.
2. **Register as DCMI/DPMI in Nigeria** if we qualify — avoid NDPC penalties.
3. **Implement consent management** — capture, withdraw, audit; required across all frameworks.
4. **Document breach notification** — have a procedure before an incident occurs.
5. **Prepare Nigeria NRS adapter** — MSME go-live Jul 2027; start design now.
6. **Confirm payment services out-of-scope** — legal opinion for UEMOA.
7. **Expand RegionalCompliance** — add Benin, CI, Senegal; align retention by country.
8. **Monitor regulatory changes** — ECOWAS revision, new e-invoicing mandates.
