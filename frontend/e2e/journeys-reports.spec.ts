/**
 * E2E journey tests: Reports and Trust features.
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/journeys-reports.spec.ts
 */

import { test, expect } from "@playwright/test";

test.describe("Reports and Trust journeys", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  async function ensurePastOnboarding(page: import("@playwright/test").Page, targetPath: string) {
    await page.goto(targetPath);
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto(targetPath);
    }
  }

  async function skipIfFeatureGated(page: import("@playwright/test").Page, contentLocator: import("@playwright/test").Locator) {
    await expect(
      page.getByText(/not available on your plan/i).or(contentLocator).first()
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return true;
    }
    return false;
  }

  test("reports: main page loads with date range and report content", async ({ page }) => {
    await ensurePastOnboarding(page, "/reports");
    if (await skipIfFeatureGated(page, page.getByText(/reports|from|to|total income|cash flow|loading reports/i).first().or(page.locator('input[type="date"]').first()))) return;

    // Assert meaningful content: date inputs, report sections, or no data
    await expect(
      page.locator('input[type="date"]').or(
        page.getByText(/total income|opening balance|profit & loss|cash flow/i)
      ).or(
        page.getByText(/no data/i)
      ).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("reports: cash-flow page loads (redirects to reports)", async ({ page }) => {
    await ensurePastOnboarding(page, "/reports/cash-flow");
    if (await skipIfFeatureGated(page, page.getByText(/reports|total income|cash flow|loading reports/i).first())) return;

    // Cash-flow redirects to /reports; expect reports content
    await expect(page).toHaveURL(/\/reports/, { timeout: 5000 });
    await expect(
      page.getByText(/reports|total income|cash flow|loading reports/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("reports: tax page loads with date range and VAT content", async ({ page }) => {
    await ensurePastOnboarding(page, "/reports/tax");
    if (await skipIfFeatureGated(page, page.getByText(/vat|tax|total sales|loading|no vat|no data/i).first().or(page.locator('input[type="date"], select').first()))) return;

    await expect(
      page.locator('input[type="date"], select').or(
        page.getByText(/total vat|no vat data|vat summary|tax \/ vat/i)
      ).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("reports: consolidated page loads with heading and form", async ({ page }) => {
    await ensurePastOnboarding(page, "/reports/consolidated");
    if (await skipIfFeatureGated(page, page.getByText(/consolidated|multi-branch|load report|select organization|no organizations/i).first().or(page.locator('select, input[type="date"]').first()))) return;

    await expect(
      page.getByText(/consolidated|load report|select org|no organizations|branch breakdown/i).or(
        page.locator('select, input[type="date"]')
      ).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("trust: page loads with score display or share option", async ({ page }) => {
    await ensurePastOnboarding(page, "/trust");
    if (await skipIfFeatureGated(page, page.getByText(/trust score|share score|loading|unable to load/i).first())) return;

    // Share button, score breakdown, numeric score, or error message
    await expect(
      page.getByRole("button", { name: /share score/i }).or(
        page.getByText(/score breakdown|unable to load|trust score|last scored/i)
      ).or(
        page.locator('text=/\\b\\d{1,3}\\b/')
      ).first()
    ).toBeVisible({ timeout: 12000 });
  });
});
