/**
 * E2E tests for public pages (no auth required).
 */

import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("sign-in page is accessible", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page).toHaveURL(/auth\/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("sign-up page is accessible", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await expect(page).toHaveURL(/auth\/sign-up/);
  });

  test("forgot-password page is accessible", async ({ page }) => {
    await page.goto("/auth/forgot-password");
    await expect(page).toHaveURL(/auth\/forgot-password/);
  });

  test("store page shows not found for unknown slug", async ({ page }) => {
    await page.goto("/store/nonexistent-slug-xyz");
    await expect(page.getByText(/business not found/i)).toBeVisible({ timeout: 10000 });
  });
});
