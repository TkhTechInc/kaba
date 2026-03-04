# QuickBooks West Africa – Product Backlog

## Current Scope (v1)

Focus on MSMEs (1–20 people): ledger, invoicing, customers, receipts, reports, tax, AI, tiered plans, access control, compliance.

---

## Backlog: v2 – Mid-Market (500+ Employees)

### Payroll

- [ ] Employee records (master data, departments, cost centers)
- [ ] Salary/wage structure (salary types, allowances, deductions)
- [ ] Pay runs (monthly, bi-weekly, weekly)
- [ ] Tax withholdings (PAYE, pension) – West Africa variants
- [ ] Payslip generation
- [ ] Bank file generation for bulk disbursement
- [ ] Payroll journal entries → ledger integration
- [ ] Statutory reports (PAYE returns, pension remittance)

### HR / People

- [ ] Employee onboarding/offboarding
- [ ] Leave management
- [ ] Attendance (basic)
- [ ] Contracts and employment types

### Accounting

- [ ] Chart of accounts (configurable)
- [ ] Double-entry journal entries
- [ ] Bank reconciliation (statement import, matching)
- [ ] Accounts payable (bills, vendors)
- [ ] Recurring transactions
- [ ] Budgets and variance reporting

### Scale & Performance

- [ ] Background job queue (e.g. SQS, Bull)
- [ ] Batch processing for pay runs
- [ ] Caching (Redis) for high-traffic endpoints
- [ ] Load testing (500+ concurrent users)
- [ ] Pagination and limits for large datasets

### Multi-Tenant

- [ ] Organization hierarchy (parent/subsidiary)
- [ ] Consolidated reporting across entities
- [ ] Delegated admin access

---

## Notes

- v2 targets small companies of ~500 employees.
- Payroll and HR are the main additions.
- Scale and accounting improvements support the larger tenant size.
