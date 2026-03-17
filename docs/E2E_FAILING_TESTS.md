# E2E Failing Tests (Dev Environment)

**Run date:** 2026-03-17  
**Target:** https://dev.kabasika.com  
**Credentials:** E2E_TEST_EMAIL, E2E_TEST_PASSWORD set

**Last updated:** Fixes applied to form-validation, journeys, journeys-data, journeys-finances, journeys-reports.

---

## Summary

| Status | Count (before fixes) |
|--------|-------|
| Passed | 14 |
| Failed | 17 unique tests |
| Skipped | 1 (kkiapay-payment) |

---

## Passed Tests

- `auth.setup` › authenticate
- `dashboard` › dashboard displays overview
- `dashboard` › invoices page loads
- `dashboard` › customers page loads
- `dashboard` › products page loads
- `form-validation` › INVOICE FORM - require customer: submit without customer stays on form
- `form-validation` › DEBT FORM - required fields: empty form does not submit
- `form-validation` › DEBT FORM - invalid amount shows error
- `journeys-reports` › reports: main page loads with date range and report content
- `journeys-reports` › reports: cash-flow page loads (redirects to reports)
- `journeys-reports` › reports: consolidated page loads with heading and form

---

## Failing Tests (by spec file)

### form-validation.spec.ts

| Test | Likely cause |
|------|--------------|
| CUSTOMER FORM - required fields: empty form does not submit | Form may submit anyway, or assertion (stay on /customers/new) fails |
| CUSTOMER FORM - invalid email shows validation error | Selector for "Please enter a valid email address" may not match; or no client-side email validation |
| PRODUCT FORM - required fields: empty form does not submit | Form may submit; or assertion fails |

### journeys-data.spec.ts

| Test | Likely cause |
|------|--------------|
| DATA REUSE - Customer in invoice: create customer → appears in invoice dropdown → create invoice → detail shows customer | Customer create or invoice create flow fails; or customer not in dropdown |
| REFRESH PERSISTENCE - Customer: create → appears in list → reload → still visible | Customer create fails before reload; or list doesn't show after reload |
| REFRESH PERSISTENCE - Product: create → appears in list → reload → still visible | Product create fails; or "not available on plan" / viewer access |
| REFRESH PERSISTENCE - Debt: create → appears in list → reload → still visible | Debt create fails; or plan restriction |

### journeys-finances.spec.ts

| Test | Likely cause |
|------|--------------|
| ledger: create entry → appears in list | Form labels (type, amount, date, description, category) or button text mismatch; or ledger feature not on plan |
| receipts: page loads and upload form visible | "Read receipt" button or file input selector mismatch; or receipts feature not on plan |
| receipts: upload file → process (smoke) | Same as above; or fixture path wrong |
| suppliers: create supplier → appears in list | "+ Add Supplier" button, modal labels, or form structure mismatch; or 30s timeout |

### journeys-reports.spec.ts

| Test | Likely cause |
|------|--------------|
| reports: tax page loads with date range and VAT content | /reports/tax may redirect or have different structure; VAT/date selectors mismatch |
| trust: page loads with score display or share option | Trust page structure different; or feature not on plan |

### journeys.spec.ts (original)

| Test | Likely cause |
|------|--------------|
| customer: create → appears in list | Placeholder "customer name" / "email address" or "Add customer" button mismatch; or plan restriction |
| invoice: create customer → create invoice → view detail | Depends on customer create; or invoice form selectors |
| product: create → appears in list | Placeholder or "Add product" mismatch; or "not available on plan" / viewer access |
| debt: create → appears in list | Placeholder or "Add debt" mismatch; or plan restriction |

---

## Root Cause Patterns

1. **Plan / feature gates**: Test user may not have invoicing, inventory, debt_tracker, ledger, receipts on plan → "not available on your plan" shown; tests may skip or fail on wrong assertion.
2. **Selector drift**: Dev UI labels/placeholders (e.g. French vs English, different wording) don't match test selectors.
3. **Form behavior**: Customer/product forms may not enforce required fields client-side; empty submit might succeed or fail differently than expected.
4. **Long timeouts**: Ledger and suppliers tests hit 30s timeout → possible slow API or modal/flow not found.

---

## Next Steps

1. Run `SEED_EMAIL=lloydharold14@gmail.com npm run fix-dev` in backend to upgrade test user to pro (if not already).
2. Inspect failing pages manually on dev to confirm labels and structure.
3. Update selectors in specs to match dev UI (including i18n if applicable).
4. For form validation: align tests with actual validation behavior (client vs server).
