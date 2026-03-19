/**
 * E2E tests for dashboard (requires auth).
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/dashboard.spec.ts
 */

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test("dashboard displays overview", async ({ page }) => {
    await page.goto("/");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await expect(page).toHaveURL(/\/($|\?)/, { timeout: 10000 });
    }
    await expect(page.getByText(/recent invoices|outstanding receivables|dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test("invoices page loads", async ({ page }) => {
    await page.goto("/invoices");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/invoices");
    }
    await expect(page.getByText(/invoices/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("customers page loads", async ({ page }) => {
    await page.goto("/customers");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/customers");
    }
    await expect(page.getByText(/customers/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("products page loads", async ({ page }) => {
    await page.goto("/products");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/products");
    }
    await expect(page.getByText(/products/i).first()).toBeVisible({ timeout: 10000 });
  });
});
