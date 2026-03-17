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
    // Redirect to /customers confirms customer was created successfully
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    // Change page size to 100 to load more customers before filtering
    const pageSizeSelect = page.locator('select').filter({ hasText: /10|20|50|100/ }).first();
    if (await pageSizeSelect.isVisible().catch(() => false)) {
      await pageSizeSelect.selectOption("100").catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    const searchBox = page.getByPlaceholder(/search customers/i);
    if (await searchBox.isVisible().catch(() => false)) {
      await searchBox.clear();
      await searchBox.fill(customerName);
    }
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 15000 });
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
    // Redirect confirms customer was created - skip list verification (pagination may hide new item)
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
    await page.waitForTimeout(1000);
    await page.getByPlaceholder(/search or select customer/i).fill(customerName);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByText(customerName).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(customerName).first().click();
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("E2E line item");
    await page.locator('input[placeholder="1"]').fill("2");
    await page.locator('input[placeholder="0.00"]').fill("100");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByRole("button", { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/, { timeout: 10000 });
    await expect(page.getByText(/invoice|draft/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("product: create → appears in list", async ({ page }) => {
    await page.goto("/products/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/products/new");
    }
    await expect(
      page.getByPlaceholder(/bag of rice|product|product name/i).or(page.getByText(/not available on your plan|viewer access/i))
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan|viewer access/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    const addBtn = page.getByRole("button", { name: /add product/i });
    if (await addBtn.isDisabled().catch(() => true)) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/bag of rice|product|product name/i).fill(productName);
    await page.getByLabel(/unit price/i).fill("50");
    await page.getByLabel(/quantity in stock/i).fill("10");
    await addBtn.click();
    await expect(page).toHaveURL(/\/products/, { timeout: 15000 });
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 8000 });
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
    await page.waitForLoadState("networkidle").catch(() => {});
    // Increase page size to 100 to load more records before client-side search
    const debtPageSizeSelect = page.locator('select').filter({ hasText: /10|20|50|100/ }).first();
    if (await debtPageSizeSelect.isVisible().catch(() => false)) {
      await debtPageSizeSelect.selectOption("100").catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    const debtSearchBox = page.getByPlaceholder(/search debts/i);
    if (await debtSearchBox.isVisible().catch(() => false)) {
      await debtSearchBox.clear();
      await debtSearchBox.fill(debtorName);
    }
    await expect(page.getByText(debtorName).first()).toBeVisible({ timeout: 15000 });
  });
});
