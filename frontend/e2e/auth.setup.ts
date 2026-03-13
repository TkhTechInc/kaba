/**
 * Auth setup: login via API and build storage state for reuse.
 * Avoids UI timing issues and ensures localStorage is correct.
 *
 * Run before dashboard tests. Credentials: E2E_TEST_EMAIL, E2E_TEST_PASSWORD
 */

import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const authDir = path.join(__dirname, "../playwright/.auth");
const authFile = path.join(authDir, "user.json");
fs.mkdirSync(authDir, { recursive: true });

const apiBase = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const appOrigin = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

setup("authenticate", async ({ request }) => {
  const email = process.env["E2E_TEST_EMAIL"];
  const password = process.env["E2E_TEST_PASSWORD"];
  if (!email || !password) {
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }), "utf-8");
    setup.skip();
    return;
  }

  const loginRes = await request.post(`${apiBase}/api/v1/auth/login/email`, {
    data: { email, password },
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const loginBody = await loginRes.json();
  const token = loginBody.accessToken ?? loginBody.data?.accessToken;
  const user = loginBody.user ?? loginBody.data?.user;
  if (!token || !user) throw new Error("Invalid login response");

  const bizRes = await request.get(`${apiBase}/api/v1/access/businesses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bizBody = bizRes.ok() ? await bizRes.json() : { data: [] };
  const businesses = Array.isArray(bizBody.data) ? bizBody.data : [];
  const businessId = businesses[0]?.businessId ?? null;

  if (businessId) {
    await request.patch(`${apiBase}/api/v1/onboarding?businessId=${businessId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { onboardingComplete: true },
    });
  }

  const storageState = {
    cookies: [] as { name: string; value: string; domain: string; path: string }[],
    origins: [
      {
        origin: appOrigin,
        localStorage: [
          { name: "qb_auth_token", value: token },
          { name: "qb_auth_user", value: JSON.stringify(user) },
          ...(businessId ? [{ name: "qb_business_id", value: businessId }] : []),
        ],
      },
    ],
  };
  fs.writeFileSync(authFile, JSON.stringify(storageState), "utf-8");
});
