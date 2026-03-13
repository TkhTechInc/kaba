/**
 * E2E tests for auth flows.
 *
 * Prerequisites:
 * - Frontend: npm run dev (localhost:3000)
 * - Backend: npm run dev (localhost:3001)
 *
 * Credentials via env: E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 *
 * Run: npx playwright test e2e/auth.spec.ts
 * Or: E2E_TEST_EMAIL=you@example.com E2E_TEST_PASSWORD=secret npx playwright test
 */

import { test, expect } from "@playwright/test";

test.describe("Auth", () => {
  test("sign-in page loads", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /phone \+ otp/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /email \+ password/i })).toBeVisible();
  });

  test("invalid login shows error", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.getByRole("button", { name: /email \+ password/i }).click();
    const form = page.locator('form[aria-label="Sign in with email and password"]');
    await form.locator('input[name="email"]').fill("invalid@example.com");
    await form.locator('input[name="password"]').fill("wrongpassword");
    await form.getByRole("button", { name: "Sign In" }).click();
    await expect(form.getByText(/invalid|incorrect|failed|email or password|too many|throttle/i)).toBeVisible({ timeout: 5000 });
  });

  test("login with email redirects to dashboard", async ({ page }) => {
    const email = process.env["E2E_TEST_EMAIL"];
    const password = process.env["E2E_TEST_PASSWORD"];
    if (!email || !password) {
      test.skip();
      return;
    }

    await page.goto("/auth/sign-in");
    await page.getByRole("button", { name: /email \+ password/i }).click();
    const form = page.locator('form[aria-label="Sign in with email and password"]');
    await form.locator('input[name="email"]').fill(email);
    await form.locator('input[name="password"]').fill(password);
    await form.getByRole("button", { name: "Sign In" }).click();

    // May land on / or /onboarding
    await page.waitForURL(/\/($|\?)|onboarding/, { timeout: 15000 });
    if (page.url().includes("/onboarding")) {
      await page.getByRole("button", { name: /skip setup/i }).click();
      await expect(page).toHaveURL(/\/($|\?)/, { timeout: 10000 });
    }
    await expect(page.getByRole("link", { name: /invoices|dashboard/i })).toBeVisible({ timeout: 10000 });
  });
});
