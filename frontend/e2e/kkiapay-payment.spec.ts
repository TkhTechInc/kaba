/**
 * E2E test for KkiaPay payment flow (widget via TKH Payments).
 * Requires: E2E_TEST_EMAIL, E2E_TEST_PASSWORD, PAYMENTS_SERVICE_URL, NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY.
 * Uses KkiaPay sandbox test phone 61000000 (MTN Benin success).
 *
 * Run: ./scripts/run-live-kkiapay-test.sh
 * Or:  E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... PAYMENTS_SERVICE_URL=... \
 *      NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY=... npx playwright test e2e/kkiapay-payment.spec.ts
 */

import { test, expect } from "@playwright/test";

const ts = Date.now();
const KKIAPAY_SANDBOX_PHONE = "61000000"; // MTN Benin success per KkiaPay sandbox docs

test.describe("KkiaPay payment flow", () => {
  test.beforeEach(() => {
    if (
      !process.env["E2E_TEST_EMAIL"] ||
      !process.env["E2E_TEST_PASSWORD"] ||
      !process.env["NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY"] ||
      !process.env["PAYMENTS_SERVICE_URL"]
    ) {
      test.skip();
    }
  });

  test("invoice: create XOF → share → pay page → KkiaPay widget → payment confirmed", async ({
    page,
  }) => {
    const customerName = `E2E KkiaPay ${ts}`;
    const customerEmail = `e2e-kkiapay-${ts}@example.com`;

    // 1. Create customer
    await page.goto("/customers/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/customers/new");
    }
    await expect(
      page
        .getByPlaceholder(/customer name/i)
        .or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (
      await page.getByText(/not available on your plan/i).isVisible().catch(() => false)
    ) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/customer name/i).fill(customerName);
    await page.getByPlaceholder(/email address/i).fill(customerEmail);
    await page.getByRole("button", { name: /add customer/i }).click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });

    // 2. Create invoice with XOF (KkiaPay currency)
    await page.goto("/invoices/new");
    await expect(
      page
        .getByPlaceholder(/search or select customer/i)
        .or(page.getByText(/not available on your plan/i))
    ).toBeVisible({ timeout: 20000 });
    if (
      await page.getByText(/not available on your plan/i).isVisible().catch(() => false)
    ) {
      test.skip();
      return;
    }
    await page.getByPlaceholder(/search or select customer/i).click();
    await page.getByText(customerName).first().click();
    // Select XOF currency (KkiaPay)
    await page.locator("select").selectOption("XOF");
    await page.getByPlaceholder(/e\.g\. consulting|description/i).fill("E2E KkiaPay line");
    await page.locator('input[placeholder="1"]').fill("1");
    await page.locator('input[placeholder="0.00"]').fill("1000");
    await page.getByRole("button", { name: /add line item/i }).click();
    await page.getByRole("button", { name: /create invoice/i }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/, { timeout: 10000 });

    const invoiceUrl = page.url();
    const match = invoiceUrl.match(/\/invoices\/([^/]+)(?:\/|$)/);
    const invoiceId = match?.[1];
    if (!invoiceId) throw new Error("Could not extract invoice ID from URL");

    // 3. Go to POS and capture share response to get payUrl
    let payUrl: string | null = null;
    const shareResponsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/share") &&
        res.request().method() === "POST" &&
        res.status() === 200,
      { timeout: 15000 }
    );
    await page.goto(`/invoices/${invoiceId}/pos`);
    const shareRes = await shareResponsePromise;
    const shareBody = await shareRes.json();
    payUrl = shareBody?.data?.payUrl ?? null;
    if (!payUrl) throw new Error("Could not get pay URL from share response");

    // 4. Wait for POS ready (QR loaded)
    await expect(
      page.getByRole("button", { name: /collected cash|encaissé en espèces/i })
    ).toBeVisible({ timeout: 15000 });

    // 5. Open pay page (public, no auth)
    await page.goto(payUrl);

    // 6. Wait for pay page to load and show KkiaPay option
    await expect(
      page.getByRole("button", { name: /pay with kkiapay/i })
    ).toBeVisible({ timeout: 15000 });

    // 7. Click "Pay with KkiaPay" — widget opens
    await page.getByRole("button", { name: /pay with kkiapay/i }).click();

    // 8. Wait for KkiaPay widget iframe and interact
    const iframe = page.frameLocator('iframe[src*="kkiapay"]').first();
    await iframe.locator('input[type="tel"], input[placeholder*="phone"], input[name*="phone"]').first().waitFor({ state: "visible", timeout: 15000 });
    await iframe
      .locator('input[type="tel"], input[placeholder*="phone"], input[name*="phone"]')
      .first()
      .fill(KKIAPAY_SANDBOX_PHONE);
    await iframe
      .getByRole("button", { name: /pay|payer|submit|valider/i })
      .first()
      .click({ timeout: 10000 });

    // 9. Wait for redirect to kkiapay-return
    await expect(page).toHaveURL(/\/pay\/kkiapay-return/, { timeout: 30000 });

    // 10. Assert payment confirmed
    await expect(
      page.getByText(/payment confirmed|paiement confirmé/i)
    ).toBeVisible({ timeout: 15000 });
  });
});
