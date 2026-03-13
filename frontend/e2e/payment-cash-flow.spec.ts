/**
 * E2E test for cash payment flow (POS "Collected cash").
 * Uses auth state from auth.setup.ts. Does NOT require TKH Payments — uses the cash-only path.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/payment-cash-flow.spec.ts
 */

import { test, expect } from "@playwright/test";

const ts = Date.now();

test.describe("Payment cash flow", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test("invoice: create → POS → collected cash → payment confirmed", async ({ page }) => {
    const customerName = `E2E Cash A ${ts}`;
    const customerEmail = `e2e-cash-a-${ts}@example.com`;
    // 1. Create customer
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

    // 2. Create invoice
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
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("E2E cash payment line");
    await page.locator('input[placeholder="1"]').fill("1");
    await page.locator('input[placeholder="0.00"]').fill("50");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByRole("button", { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/, { timeout: 10000 });

    // 3. Navigate to POS page
    const invoiceUrl = page.url();
    const match = invoiceUrl.match(/\/invoices\/([^/]+)(?:\/|$)/);
    const invoiceId = match?.[1];
    if (!invoiceId) throw new Error("Could not extract invoice ID from URL");
    await page.goto(`/invoices/${invoiceId}/pos`);

    // 4. Wait for POS ready (QR + cash button)
    await expect(
      page.getByRole("button", { name: /collected cash|encaissé en espèces/i })
    ).toBeVisible({ timeout: 15000 });

    // 5. Click "Collected cash"
    await page.getByRole("button", { name: /collected cash|encaissé en espèces/i }).click();

    // 6. Assert payment confirmed
    await expect(
      page.getByText(/payment confirmed|paiement confirmé/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("invoice: create → POS → collected cash → verify paid on invoices list", async ({ page }) => {
    const customerName = `E2E Cash B ${ts}`;
    const customerEmail = `e2e-cash-b-${ts}@example.com`;
    // 1. Create customer
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

    // 2. Create invoice
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
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("E2E cash payment line");
    await page.locator('input[placeholder="1"]').fill("1");
    await page.locator('input[placeholder="0.00"]').fill("75");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByRole("button", { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/, { timeout: 10000 });

    const invoiceUrl = page.url();
    const match = invoiceUrl.match(/\/invoices\/([^/]+)(?:\/|$)/);
    const invoiceId = match?.[1];
    if (!invoiceId) throw new Error("Could not extract invoice ID from URL");

    // 3. Go to POS and mark as paid
    await page.goto(`/invoices/${invoiceId}/pos`);
    await expect(
      page.getByRole("button", { name: /collected cash|encaissé en espèces/i })
    ).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /collected cash|encaissé en espèces/i }).click();
    await expect(
      page.getByText(/payment confirmed|paiement confirmé/i)
    ).toBeVisible({ timeout: 10000 });

    // 4. Navigate back to invoices list and verify status
    await page.getByRole("link", { name: /back to invoices/i }).click();
    await expect(page).toHaveURL(/\/invoices/, { timeout: 5000 });
    // Invoice should show as paid (status badge or row)
    await expect(page.getByText(/paid/i).first()).toBeVisible({ timeout: 5000 });
  });
});
