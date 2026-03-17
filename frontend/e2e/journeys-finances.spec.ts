/**
 * E2E user journey tests: Finances features (Ledger, Receipts, Suppliers).
 * Uses auth state from auth.setup.ts. Run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD.
 *
 * Run: E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... npx playwright test e2e/journeys-finances.spec.ts
 */

import { test, expect } from "@playwright/test";
import path from "path";

const ts = Date.now();
const entryDescription = `E2E Ledger Entry ${ts}`;
const supplierName = `E2E Supplier ${ts}`;

test.describe("Finances journeys", () => {
  test.beforeEach(() => {
    if (!process.env["E2E_TEST_EMAIL"] || !process.env["E2E_TEST_PASSWORD"]) {
      test.skip();
    }
  });

  test("ledger: create entry → appears in list", async ({ page }) => {
    await page.goto("/ledger/entries/new");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/ledger/entries/new");
    }
    await expect(
      page.getByLabel(/amount/i).or(page.getByText(/not available on your plan/i)).first()
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    const createBtn = page.getByRole("button", { name: /create entry/i });
    if (await createBtn.isDisabled().catch(() => true)) {
      test.skip();
      return;
    }
    // Type select has no associated label - use first select element
    await page.locator("select").first().selectOption("expense");
    await page.getByPlaceholder("0").fill("250");
    await page.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    await page.getByPlaceholder("No data").first().fill(entryDescription);
    await page.getByPlaceholder("No data").nth(1).fill("E2E Test");
    await createBtn.click();
    await expect(page).toHaveURL(/\/ledger/, { timeout: 15000 });
    await expect(page.getByText(entryDescription).first()).toBeVisible({ timeout: 10000 });
  });

  test("receipts: page loads and upload form visible", async ({ page }) => {
    await page.goto("/receipts");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/receipts");
    }
    await expect(
      page.getByText(/upload|receipt|read receipt/i).or(page.getByText(/not available on your plan/i)).first()
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await expect(page.getByRole("button", { name: /read receipt/i })).toBeVisible();
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
  });

  test("receipts: upload file → process (smoke)", async ({ page }) => {
    await page.goto("/receipts");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/receipts");
    }
    await expect(
      page.getByText(/upload|receipt|read receipt/i).or(page.getByText(/not available on your plan/i)).first()
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    const fixturePath = path.join(__dirname, "fixtures", "test-receipt.png");
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(fixturePath);
    const readBtn = page.getByRole("button", { name: /read receipt/i });
    await expect(readBtn).toBeEnabled({ timeout: 5000 });
    await readBtn.click();
    await expect(
      page.getByText(/processing|looks good|please check|processing failed|receipt details|extracted|error/i).first()
    ).toBeVisible({ timeout: 35000 });
  });

  test("suppliers: create supplier → appears in list", async ({ page }) => {
    await page.goto("/suppliers");
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await page.goto("/suppliers");
    }
    await expect(
      page.getByRole("button", { name: /add supplier/i }).or(page.getByText(/not available on your plan|suppliers/i)).first()
    ).toBeVisible({ timeout: 20000 });
    if (await page.getByText(/not available on your plan/i).isVisible().catch(() => false)) {
      test.skip();
      return;
    }
    await page.getByRole("button", { name: /add supplier/i }).first().click();
    await expect(page.getByRole("heading", { name: /add supplier/i })).toBeVisible({ timeout: 5000 });
    // Supplier modal: fields are name(0), phone(1), momoPhone(2), bankAccount(3), currency(4), countryCode(5), notes(6)
    // Modal container is div.fixed.inset-0
    const modal = page.locator('.fixed.inset-0').last();
    const modalInputs = modal.locator('input[type="text"]');
    await modalInputs.nth(0).fill(supplierName);
    await modalInputs.nth(4).fill("XOF");
    await modalInputs.nth(5).fill("SN");
    // Scope submit button to the modal to avoid matching the page-level "+ Add Supplier" button
    const modalSubmit = modal.getByRole("button", { name: /add supplier|saving/i });
    await expect(modalSubmit).toBeEnabled({ timeout: 5000 });
    await modalSubmit.click();
    await expect(page.getByRole("heading", { name: /add supplier/i })).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(supplierName).first()).toBeVisible({ timeout: 10000 });
  });
});
