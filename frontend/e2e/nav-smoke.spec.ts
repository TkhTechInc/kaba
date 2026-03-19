/**
 * Nav smoke tests: visit each nav route and verify page loads without error.
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/nav-smoke.spec.ts
 */

import { test, expect } from "@playwright/test";

/** Routes derived from NAV_DATA + key subpages. Feature-gated pages may show upgrade prompt. */
const NAV_ROUTES: { url: string; label: string }[] = [
  { url: "/", label: "Dashboard" },
  { url: "/invoices", label: "Invoices" },
  { url: "/customers", label: "Customers" },
  { url: "/invoices/pending-approval", label: "Pending Approvals" },
  { url: "/ledger", label: "Ledger" },
  { url: "/receipts", label: "Receipts" },
  { url: "/reconciliation", label: "Mobile Money" },
  { url: "/debts", label: "Debts" },
  { url: "/suppliers", label: "Suppliers" },
  { url: "/products", label: "Products" },
  { url: "/reports", label: "Reports" },
  { url: "/reports/tax", label: "Reports Tax" },
  { url: "/reports/consolidated", label: "Reports Consolidated" },
  { url: "/trust", label: "Trust Score" },
  { url: "/settings/branches", label: "Branches" },
  { url: "/settings", label: "Settings" },
  { url: "/settings/profile", label: "Settings Profile" },
  { url: "/settings/team", label: "Settings Team" },
  { url: "/settings/activity", label: "Settings Activity" },
  { url: "/settings/preferences", label: "Settings Preferences" },
  { url: "/settings/api-keys", label: "Settings API Keys" },
  { url: "/settings/webhooks", label: "Settings Webhooks" },
  { url: "/settings/compliance", label: "Settings Compliance" },
  { url: "/admin", label: "Admin" },
];

async function skipOnboardingIfShown(page: import("@playwright/test").Page) {
  if (page.url().includes("/onboarding")) {
    const skipBtn = page.getByRole("button", { name: /skip setup/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
      await expect(page).toHaveURL(/\/($|\?)/, { timeout: 10000 });
    }
  }
}

test.describe("Nav smoke", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test.describe.configure({ retries: 1 });

  for (const { url, label } of NAV_ROUTES) {
    test(`${label} (${url}) loads without error`, async ({ page }) => {
      await page.goto(url);
      await skipOnboardingIfShown(page);

      // Allow time for page to settle
      await page.waitForLoadState("networkidle").catch(() => {});

      // Must not show generic error page (avoid matching numbers like 5000, 2 500 XOF)
      await expect(
        page.getByText(/500\s+internal|internal\s+server\s+error|something\s+went\s+wrong/i)
      ).not.toBeVisible({ timeout: 2000 });

      // Page should show either main content or expected upgrade/plan message
      const hasContent =
        (await page.getByRole("heading").first().isVisible().catch(() => false)) ||
        (await page.getByText(/not available on your plan|upgrade|viewer access|plan required/i).isVisible().catch(() => false)) ||
        (await page.getByRole("main").isVisible().catch(() => false)) ||
        (await page.getByRole("table").isVisible().catch(() => false)) ||
        (await page.getByRole("form").isVisible().catch(() => false));

      expect(hasContent).toBe(true);
    });
  }
});
