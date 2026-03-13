/**
 * E2E user journey tests: create → list → view flows.
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/journeys.spec.ts
 */

import { test, expect } from "@playwright/test";

const ts = Date.now();
const customerName = `E2E Customer ${ts}`;
const customerEmail = `e2e-${ts}@example.com`;
const productName = `E2E Product ${ts}`;
const debtorName = `E2E Debtor ${ts}`;

test.describe("User journeys", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test("customer: create → appears in list", async ({ page }) => {
    await page.goto("/customers/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/customers/new");
    }
    // Wait for page to settle: either form or upgrade prompt (heading appears during loading)
    await expect(
      page.getByPlaceholder(/customer name/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/customer name/i).fill(customerName);
    await page.getByPlaceholder(/email address/i).fill(customerEmail);
    await page.getByRole("button", { name: /add customer/i }).click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 5000 });
  });

  test("invoice: create customer → create invoice → view detail", async ({ page }) => {
    await page.goto("/customers/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/customers/new");
    }
    await expect(
      page.getByPlaceholder(/customer name/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/customer name/i).fill(customerName);
    await page.getByPlaceholder(/email address/i).fill(customerEmail);
    await page.getByRole("button", { name: /add customer/i }).click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });

    await page.goto("/invoices/new");
    await expect(
      page.getByPlaceholder(/search or select customer/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/search or select customer/i).click();
    await page.getByText(customerName).first().click();
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("E2E line item");
    await page.locator('input[placeholder="1"]').fill("2");
    await page.locator('input[placeholder="0.00"]').fill("100");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByRole("button", { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/, { timeout: 10000 });
    await expect(page.getByText(/invoice|draft/i)).toBeVisible({ timeout: 5000 });
  });

  test("product: create → appears in list", async ({ page }) => {
    await page.goto("/products/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/products/new");
    }
    await expect(
      page.getByPlaceholder(/bag of rice|product/i).or(page.getByText(/not available on your plan|viewer access/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan|viewer access/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/bag of rice|product/i).fill(productName);
    await page.getByLabel(/unit price/i).fill("50");
    await page.getByLabel(/quantity in stock/i).fill("10");
    await page.getByRole("button", { name: /add product/i }).click();
    await expect(page).toHaveURL(/\/products/, { timeout: 15000 });
    await expect(page.getByText(productName)).toBeVisible({ timeout: 5000 });
  });

  test("debt: create → appears in list", async ({ page }) => {
    await page.goto("/debts/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/debts/new");
    }
    await expect(
      page.getByPlaceholder(/person or business/i).or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/person or business/i).fill(debtorName);
    await page.getByLabel(/amount/i).fill("500");
    await page.getByLabel(/due date/i).fill(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
    await page.getByRole("button", { name: /add debt/i }).click();
    await expect(page).toHaveURL(/\/debts/, { timeout: 10000 });
    await expect(page.getByText(debtorName)).toBeVisible({ timeout: 5000 });
  });
});
