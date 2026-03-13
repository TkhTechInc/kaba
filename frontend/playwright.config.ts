import { defineConfig, devices } from "@playwright/test";
import path from "path";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const authFile = path.join(__dirname, "playwright/.auth/user.json");
const useRemoteBase = baseURL.includes("://") && !baseURL.includes("localhost");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /public\.spec\.ts/,
    },
    {
      name: "chromium-auth",
      use: { ...devices["Desktop Chrome"], storageState: { cookies: [], origins: [] } },
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "chromium-dashboard",
      use: { ...devices["Desktop Chrome"], storageState: authFile },
      testMatch: /(dashboard|journeys|payment-cash-flow|kkiapay-payment)\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: useRemoteBase
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120 * 1000,
      },
});
