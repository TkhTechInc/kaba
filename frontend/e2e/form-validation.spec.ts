/**
 * E2E form validation tests.
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/form-validation.spec.ts
 */

import { test, expect } from "@playwright/test";

async function handleOnboarding(page: { url: () => string; getByRole: (role: string, opts: { name: RegExp }) => Promise<{ click: () => Promise<void> }> }) {
  if (page.url().includes("/onboarding")) {
    await page.getByRole("button", { name: /skip setup/i }).click();
  }
}

async function skipIfPlanRestricted(page: { getByText: (text: RegExp) => Promise<{ isVisible: () => Promise<boolean> }> }) {
  const restricted = await page.getByText(/not available on your plan|viewer access/i).isVisible().catch(() => false);
  if (restricted) test.skip();
  return restricted;
}

test.describe("Form validation", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test("CUSTOMER FORM - required fields: empty form does not submit", async ({ page }) => {
    await page.goto("/customers/new");
    await handleOnboarding(page);
    await page.goto("/customers/new");

    await expect(
      page.getByPlaceholder(/customer name/i).first().or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    const submitBtn = page.getByRole("button", { name: /add customer/i });
    await submitBtn.click();

    // handleSubmit returns early when !form.name.trim() - stay on form (no redirect to /customers)
    await expect(page).toHaveURL(/\/customers\/new/, { timeout: 3000 });
  });

  test("CUSTOMER FORM - invalid email shows validation error", async ({ page }) => {
    await page.goto("/customers/new");
    await handleOnboarding(page);
    await page.goto("/customers/new");

    await expect(
      page.getByPlaceholder(/customer name/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    await page.getByPlaceholder(/customer name/i).fill("Test Customer");
    await page.getByPlaceholder(/email address/i).fill("notanemail");
    await page.getByRole("button", { name: /add customer/i }).click();

    // Client-side validation shows error (customerNew.emailError)
    await expect(
      page.getByText(/please enter a valid email|valid email address|enter a valid email/i)
    ).toBeVisible({ timeout: 8000 });
    await expect(page).toHaveURL(/\/customers\/new/);
  });

  test("INVOICE FORM - require customer: submit without customer stays on form", async ({ page }) => {
    await page.goto("/invoices/new");
    await handleOnboarding(page);
    await page.goto("/invoices/new");

    await expect(
      page.getByPlaceholder(/search or select customer/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    // Add a line item so Create Invoice button becomes enabled (it's disabled when items.length === 0)
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("Test item");
    await page.locator('input[placeholder="1"]').fill("1");
    await page.locator('input[placeholder="0.00"]').fill("100");
    await page.getByRole("button", { name: /add line item|add item/i }).click();

    // Do NOT select a customer - submit without customer
    const createBtn = page.getByRole("button", { name: /create invoice/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Form returns early when !form.customerId - no navigation, no error shown
    await expect(page).toHaveURL(/\/invoices\/new/);
    await expect(page.getByPlaceholder(/search or select customer/i)).toBeVisible();
  });

  test("PRODUCT FORM - required fields: empty form does not submit", async ({ page }) => {
    await page.goto("/products/new");
    await handleOnboarding(page);
    await page.goto("/products/new");

    await expect(
      page.getByPlaceholder(/bag of rice|product|product name/i).or(page.getByText(/not available on your plan|viewer access/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    // Skip if viewer (button disabled)
    const submitBtn = page.getByRole("button", { name: /add product/i });
    if (await submitBtn.isDisabled().catch(() => true)) {
      test.skip();
      return;
    }
    await submitBtn.click();

    // handleSubmit returns early when !form.name.trim() - stay on form
    await expect(page).toHaveURL(/\/products\/new/, { timeout: 3000 });
  });

  test("DEBT FORM - required fields: empty form does not submit", async ({ page }) => {
    await page.goto("/debts/new");
    await handleOnboarding(page);
    await page.goto("/debts/new");

    await expect(
      page.getByPlaceholder(/person or business/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    const submitBtn = page.getByRole("button", { name: /add debt/i });
    await submitBtn.click();

    // handleSubmit returns early when !form.debtorName.trim() || !form.amount - stay on form
    await expect(page).toHaveURL(/\/debts\/new/);
    await expect(page.getByPlaceholder(/person or business/i)).toBeVisible();
  });

  test("DEBT FORM - invalid amount shows error", async ({ page }) => {
    await page.goto("/debts/new");
    await handleOnboarding(page);
    await page.goto("/debts/new");

    await expect(
      page.getByPlaceholder(/person or business/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await skipIfPlanRestricted(page)) return;

    await page.getByPlaceholder(/person or business/i).fill("Test Debtor");
    await page.getByLabel(/amount/i).fill("-1");
    await page.getByLabel(/due date/i).fill(new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: /add debt/i }).click();

    // Backend rejects amount < 0 - error shown
    await expect(page).toHaveURL(/\/debts\/new/);
    await expect(page.getByText(/failed|invalid|error|must not be less/i)).toBeVisible({ timeout: 5000 });
  });
});
