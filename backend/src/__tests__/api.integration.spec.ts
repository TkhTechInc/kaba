/**
 * Integration tests against the real Kaba API.
 *
 * Prerequisites:
 * - Backend running: npm run dev (localhost:3001)
 * - Set INTEGRATION_TEST_EMAIL + INTEGRATION_TEST_PASSWORD, or INTEGRATION_TEST_TOKEN
 *
 * Run:
 *   INTEGRATION_TEST_EMAIL=test@example.com INTEGRATION_TEST_PASSWORD=secret \
 *     npm run test:integration
 *
 * Or:
 *   INTEGRATION_TEST_TOKEN=eyJ... npm run test:integration
 */

const API_URL = process.env['INTEGRATION_TEST_API_URL'] ?? 'http://localhost:3001';
const TEST_EMAIL = process.env['INTEGRATION_TEST_EMAIL'];
const TEST_PASSWORD = process.env['INTEGRATION_TEST_PASSWORD'];
const TEST_TOKEN = process.env['INTEGRATION_TEST_TOKEN'];

const hasAuth =
  (TEST_EMAIL && TEST_PASSWORD) || TEST_TOKEN;

const describeIfAuth = hasAuth ? describe : describe.skip;

interface AuthContext {
  token: string;
  businessId: string;
  userId: string;
}

async function login(): Promise<AuthContext> {
  if (TEST_TOKEN) {
    const res = await fetch(`${API_URL}/api/v1/access/businesses`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Token invalid: ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ businessId?: string; id?: string }> };
    const biz = json.data?.[0];
    const businessId = biz?.businessId ?? biz?.id ?? '';
    if (!businessId) throw new Error(`Token valid but no business found. Ensure user has a business.`);
    return { token: TEST_TOKEN, businessId, userId: '' };
  }
  const res = await fetch(`${API_URL}/api/v1/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(err)}`);
  }
  const json = (await res.json()) as {
    token?: string;
    accessToken?: string;
    data?: { token?: string; user?: { id?: string; businesses?: Array<{ businessId?: string; id?: string }> } };
    user?: { id?: string; businesses?: Array<{ businessId?: string; id?: string }> };
  };
  const token = json.token ?? json.accessToken ?? json.data?.token;
  const user = json.user ?? json.data?.user;
  let businessId = user?.businesses?.[0]?.businessId ?? user?.businesses?.[0]?.id ?? '';
  if (!token) {
    throw new Error(`Login response missing token: ${JSON.stringify(json)}`);
  }
  if (!businessId) {
    const bizRes = await fetch(`${API_URL}/api/v1/access/businesses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bizJson = (await bizRes.json()) as {
      data?: Array<{ businessId?: string; id?: string }>;
    };
    const first = bizJson.data?.[0];
    businessId = first?.businessId ?? first?.id ?? '';
    if (!businessId && !bizRes.ok) {
      throw new Error(
        `Businesses API failed: ${bizRes.status} ${JSON.stringify(bizJson)}. Ensure backend is running and token is valid.`,
      );
    }
  }
  if (!businessId) {
    throw new Error(
      `No business found for user. Run fix-dev or ensure user has a business. Login response had token but /access/businesses returned empty.`,
    );
  }
  return { token, businessId, userId: user?.id ?? '' };
}

async function api(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; query?: Record<string, string> } = {},
): Promise<{ status: number; json: unknown; ok: boolean }> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const fullUrl = opts.query
    ? `${url}${url.includes('?') ? '&' : '?'}${new URLSearchParams(opts.query).toString()}`
    : url;
  const res = await fetch(fullUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = { raw: await res.text() };
  }
  return { status: res.status, json, ok: res.ok };
}

describe('API Integration (real backend)', () => {
  let auth: AuthContext;

  beforeAll(async () => {
    if (!hasAuth) return;
    auth = await login();
  }, 30000);

  describe('Health', () => {
    it('GET /health returns 200 with status ok', async () => {
      const { status, json, ok } = await api('GET', '/health');
      expect(ok).toBe(true);
      expect(status).toBe(200);
      const body = json as { status?: string; message?: string; timestamp?: string };
      expect(body.status).toBe('ok');
      expect(body.message).toContain('running');
      expect(body.timestamp).toBeDefined();
    });
  });

  describeIfAuth('Auth & Access', () => {
    it('GET /api/v1/access/businesses returns list', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/access/businesses', {
        token: auth.token,
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      const data = (json as { data?: unknown[] }).data;
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/v1/access/organizations returns list', async () => {
      const { status, ok } = await api('GET', '/api/v1/access/organizations', {
        token: auth.token,
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    });
  });

  describeIfAuth('Dashboard', () => {
    it('GET /api/v1/dashboard/summary', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/dashboard/summary', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      expect((json as { data?: unknown }).data).toBeDefined();
    });

    it('GET /api/v1/dashboard/payments-overview', async () => {
      const { status, ok } = await api('GET', '/api/v1/dashboard/payments-overview', {
        token: auth.token,
        query: { businessId: auth.businessId, timeFrame: 'monthly' },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    }, 25000);

    it('GET /api/v1/dashboard/weeks-profit', async () => {
      const { status, ok } = await api('GET', '/api/v1/dashboard/weeks-profit', {
        token: auth.token,
        query: { businessId: auth.businessId, timeFrame: 'this week' },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    });

    it('GET /api/v1/mobile/home', async () => {
      const { status, ok } = await api('GET', '/api/v1/mobile/home', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    }, 25000);
  });

  describeIfAuth('Invoices', () => {
    it('GET /api/v1/invoices list', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/invoices', {
        token: auth.token,
        query: { businessId: auth.businessId, page: '1', limit: '20' },
      });
      expect([200, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { items?: unknown[] } }).data;
        expect(data).toBeDefined();
        expect(Array.isArray(data?.items)).toBe(true);
      }
    });
  });

  describeIfAuth('Customers', () => {
    it('GET /api/v1/customers list', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/customers', {
        token: auth.token,
        query: { businessId: auth.businessId, page: '1', limit: '20' },
      });
      expect([200, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { items?: unknown[] } }).data;
        expect(data).toBeDefined();
        expect(Array.isArray(data?.items)).toBe(true);
      }
    });
  });

  describeIfAuth('Ledger', () => {
    it('GET /api/v1/ledger/entries', async () => {
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      const to = new Date();
      const { status, json, ok } = await api('GET', '/api/v1/ledger/entries', {
        token: auth.token,
        query: {
          businessId: auth.businessId,
          fromDate: from.toISOString().slice(0, 10),
          toDate: to.toISOString().slice(0, 10),
        },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      const data = (json as { data?: { items?: unknown[] } }).data;
      expect(data).toBeDefined();
      expect(Array.isArray(data?.items)).toBe(true);
    });

    it('GET /api/v1/ledger/balance', async () => {
      const { status, ok } = await api('GET', '/api/v1/ledger/balance', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    });
  });

  describeIfAuth('Products', () => {
    it('GET /api/v1/products list', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/products', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect([200, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { items?: unknown[] } }).data;
        expect(data).toBeDefined();
        expect(Array.isArray(data?.items ?? data)).toBe(true);
      }
    });
  });

  describeIfAuth('Reports', () => {
    function reportParams() {
      const from = new Date();
      from.setMonth(from.getMonth() - 1);
      const to = new Date();
      return {
        businessId: auth.businessId,
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
      };
    }

    it('GET /api/v1/reports/pl', async () => {
      const { status, ok } = await api('GET', '/api/v1/reports/pl', {
        token: auth.token,
        query: reportParams(),
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    });

    it('GET /api/v1/reports/cash-flow', async () => {
      const { status, ok } = await api('GET', '/api/v1/reports/cash-flow', {
        token: auth.token,
        query: reportParams(),
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
    });
  });

  describeIfAuth('Onboarding', () => {
    it('GET /api/v1/onboarding', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/onboarding', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      expect((json as { data?: unknown }).data).toBeDefined();
    });
  });

  describeIfAuth('Organizations & Branches', () => {
    it('GET /api/v1/org list organizations', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/org', {
        token: auth.token,
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      const data = (json as { data?: unknown[] }).data;
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Storefront (public)', () => {
    it('GET /api/v1/storefront/:slug returns 404 for unknown slug', async () => {
      const { status, json } = await api('GET', '/api/v1/storefront/nonexistent-slug-xyz');
      expect(status).toBe(404);
      const body = json as { statusCode?: number; message?: string };
      expect(body.statusCode ?? body.message).toBeDefined();
    });
  });

  describe('Unauthenticated', () => {
    it('GET /api/v1/dashboard/summary without token returns 401', async () => {
      const { status, json } = await api('GET', '/api/v1/dashboard/summary', {
        query: { businessId: 'biz-any' },
      });
      expect(status).toBe(401);
      const body = json as { statusCode?: number; message?: string };
      expect(body.statusCode).toBe(401);
    });

    it('POST /api/v1/auth/login/email with invalid credentials returns 401', async () => {
      const { status, json } = await api('POST', '/api/v1/auth/login/email', {
        body: { email: 'nonexistent@example.com', password: 'wrongpassword' },
      });
      expect(status).toBe(401);
      const body = json as { statusCode?: number; message?: string };
      expect(body.statusCode).toBe(401);
    });
  });

  describeIfAuth('Create flows', () => {
    it('POST /api/v1/customers creates customer', async () => {
      const { status, json, ok } = await api('POST', '/api/v1/customers', {
        token: auth.token,
        body: {
          businessId: auth.businessId,
          name: 'Integration Test Customer',
          email: `test-${Date.now()}@example.com`,
        },
      });
      expect([201, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { id?: string } }).data;
        expect(data?.id).toBeDefined();
      }
    });

    it('POST /api/v1/products creates product', async () => {
      const { status, json, ok } = await api('POST', '/api/v1/products', {
        token: auth.token,
        body: {
          businessId: auth.businessId,
          name: 'Integration Test Product',
          unitPrice: 1000,
          currency: 'XOF',
          quantityInStock: 10,
        },
      });
      expect([201, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { id?: string } }).data;
        expect(data?.id).toBeDefined();
      }
    });

    it('POST /api/v1/ledger/entries creates ledger entry', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { status, json, ok } = await api('POST', '/api/v1/ledger/entries', {
        token: auth.token,
        body: {
          businessId: auth.businessId,
          type: 'sale',
          amount: 5000,
          currency: 'XOF',
          description: 'Integration test sale',
          date: today,
        },
      });
      expect(ok).toBe(true);
      expect(status).toBe(201);
      const data = (json as { data?: { id?: string } }).data;
      expect(data?.id).toBeDefined();
    });

    it('POST /api/v1/suppliers creates supplier', async () => {
      const { status, json, ok } = await api('POST', '/api/v1/suppliers', {
        token: auth.token,
        query: { businessId: auth.businessId },
        body: {
          name: 'Integration Test Supplier',
          currency: 'XOF',
          countryCode: 'BJ',
        },
      });
      expect(ok).toBe(true);
      expect(status).toBe(201);
      const data = (json as { data?: { id?: string } }).data;
      expect(data?.id).toBeDefined();
    });
  });

  describeIfAuth('Invoice create & share', () => {
    let customerId: string;

    beforeAll(async () => {
      const { json } = await api('POST', '/api/v1/customers', {
        token: auth.token,
        body: {
          businessId: auth.businessId,
          name: 'Share Test Customer',
          email: `share-test-${Date.now()}@example.com`,
        },
      });
      customerId = (json as { data?: { id?: string } }).data?.id ?? '';
    }, 10000);

    it('POST /api/v1/invoices creates invoice', async () => {
      if (!customerId) return;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const { status, json, ok } = await api('POST', '/api/v1/invoices', {
        token: auth.token,
        body: {
          businessId: auth.businessId,
          customerId,
          amount: 15000,
          currency: 'XOF',
          items: [{ description: 'Test item', quantity: 1, unitPrice: 15000, amount: 15000 }],
          dueDate: dueDate.toISOString().slice(0, 10),
        },
      });
      expect(ok).toBe(true);
      expect(status).toBe(201);
      const data = (json as { data?: { id?: string } }).data;
      expect(data?.id).toBeDefined();
    });

    it('POST /api/v1/invoices/:id/share returns token and payUrl', async () => {
      const listRes = await api('GET', '/api/v1/invoices', {
        token: auth.token,
        query: { businessId: auth.businessId, page: '1', limit: '5' },
      });
      const items = (listRes.json as { data?: { items?: Array<{ id?: string }> } }).data?.items ?? [];
      const invoiceId = items[0]?.id;
      if (!invoiceId) return;
      const { status, json, ok } = await api('POST', `/api/v1/invoices/${invoiceId}/share`, {
        token: auth.token,
        body: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect([200, 201]).toContain(status);
      const data = (json as { data?: { token?: string; payUrl?: string } }).data;
      expect(data?.token).toBeDefined();
      expect(data?.payUrl).toBeDefined();
    });
  });

  describeIfAuth('Debts', () => {
    it('GET /api/v1/debts list returns 200 or 403', async () => {
      const { status, ok } = await api('GET', '/api/v1/debts', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect([200, 403]).toContain(status);
    });
  });

  describeIfAuth('Suppliers', () => {
    it('GET /api/v1/suppliers list', async () => {
      const { status, json, ok } = await api('GET', '/api/v1/suppliers', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect(ok).toBe(true);
      expect(status).toBe(200);
      const data = (json as { data?: { items?: unknown[] } }).data;
      expect(data).toBeDefined();
      expect(Array.isArray(data?.items ?? data)).toBe(true);
    });
  });

  describeIfAuth('Trust', () => {
    it('GET /api/v1/trust/my-score', async () => {
      const { status } = await api('GET', '/api/v1/trust/my-score', {
        token: auth.token,
        query: { businessId: auth.businessId },
      });
      expect([200, 403]).toContain(status);
    });

    it('POST /api/v1/trust/share returns shareUrl', async () => {
      const { status, json, ok } = await api('POST', '/api/v1/trust/share', {
        token: auth.token,
        body: { businessId: auth.businessId },
      });
      expect([200, 201, 403]).toContain(status);
      if (ok) {
        const data = (json as { data?: { shareUrl?: string } }).data;
        expect(data?.shareUrl).toBeDefined();
      }
    });
  });

  describeIfAuth('Receipts', () => {
    it('GET /api/v1/receipts/upload-url returns uploadUrl or 403', async () => {
      const { status } = await api('GET', '/api/v1/receipts/upload-url', {
        token: auth.token,
        query: { businessId: auth.businessId, contentType: 'image/jpeg' },
      });
      expect([200, 403]).toContain(status);
    });
  });

  describe('Customer portal (public)', () => {
    it('GET /api/v1/customers/portal/lookup returns 200 or 404', async () => {
      const { status } = await api('GET', '/api/v1/customers/portal/lookup', {
        query: { businessId: 'biz-any', email: 'nonexistent@example.com' },
      });
      expect([200, 404]).toContain(status);
    });
  });

  describeIfAuth('Organizations & Branches (create)', () => {
    it('POST /api/v1/org creates organization', async () => {
      const { status, json, ok } = await api('POST', '/api/v1/org', {
        token: auth.token,
        body: {
          name: `Test Org ${Date.now()}`,
          businessId: auth.businessId,
        },
      });
      expect(ok).toBe(true);
      expect([200, 201]).toContain(status);
      const data = (json as { data?: { id?: string } }).data;
      expect(data?.id).toBeDefined();
    });

    it('POST /api/v1/org/branches creates branch', async () => {
      const orgRes = await api('GET', '/api/v1/org', { token: auth.token });
      const orgs = (orgRes.json as { data?: Array<{ id?: string }> }).data ?? [];
      const orgId = orgs[0]?.id;
      if (!orgId) return;
      const { status, json, ok } = await api('POST', '/api/v1/org/branches', {
        token: auth.token,
        body: {
          organizationId: orgId,
          name: `Test Branch ${Date.now()}`,
          parentBusinessId: auth.businessId,
          countryCode: 'BJ',
          currency: 'XOF',
        },
      });
      expect(ok).toBe(true);
      expect([200, 201]).toContain(status);
      const data = (json as { data?: { id?: string } }).data;
      expect(data?.id).toBeDefined();
    });
  });

  describeIfAuth('403 for wrong business', () => {
    it('GET /api/v1/dashboard/summary with inaccessible businessId returns 403', async () => {
      const { status, json } = await api('GET', '/api/v1/dashboard/summary', {
        token: auth.token,
        query: { businessId: 'biz-nonexistent-other-user' },
      });
      expect(status).toBe(403);
      const body = json as { statusCode?: number; message?: string };
      expect(body.statusCode ?? body.message).toBeDefined();
    });
  });
});
