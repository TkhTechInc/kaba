/**
 * Integration tests for PaymentsClient against mocked TKH Payments API.
 *
 * Uses nock to mock HTTP responses. No real TKH Payments or gateways required.
 * Run: npx jest PaymentsClient.integration --no-coverage --verbose
 */

import nock from 'nock';
import { PaymentsClient } from '../services/PaymentsClient';

const BASE_URL = 'https://payments-test.example.com';

function setupClient(): PaymentsClient {
  const prev = process.env['PAYMENTS_SERVICE_URL'];
  process.env['PAYMENTS_SERVICE_URL'] = BASE_URL;
  try {
    return new PaymentsClient();
  } finally {
    if (prev !== undefined) process.env['PAYMENTS_SERVICE_URL'] = prev;
    else delete process.env['PAYMENTS_SERVICE_URL'];
  }
}

describe('PaymentsClient integration (mocked TKH Payments)', () => {
  let client: PaymentsClient;

  beforeAll(() => {
    // Disable MoMo/KkiaPay test overrides so nock response is used as-is
    delete process.env['MOMO_TEST_CURRENCY'];
    delete process.env['MOMO_TEST_COUNTRY'];
    delete process.env['MOMO_TEST_FORCE_MOMO_UI'];
    delete process.env['MOMO_TEST_FORCE_GH'];
    delete process.env['KKIAPAY_TEST_FORCE_UI'];
    client = setupClient();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createIntent', () => {
    it('returns paymentUrl when TKH Payments succeeds', async () => {
      nock(BASE_URL)
        .post('/intents', (body) => {
          expect(body.amount).toBe(50000);
          expect(body.currency).toBe('XOF');
          expect(body.metadata.appId).toBe('kaba');
          expect(body.metadata.referenceId).toBe('inv-001');
          return true;
        })
        .reply(200, {
          id: 'intent-abc-123',
          status: 'pending',
          paymentUrl: 'https://pay.example.com/checkout/intent-abc-123',
        });

      const result = await client.createIntent({
        amount: 50000,
        currency: 'XOF',
        country: 'BJ',
        metadata: {
          appId: 'kaba',
          referenceId: 'inv-001',
          businessId: 'biz-001',
          invoiceId: 'inv-001',
        },
      });

      expect(result.success).toBe(true);
      expect(result.paymentUrl).toBe('https://pay.example.com/checkout/intent-abc-123');
      expect(result.intentId).toBe('intent-abc-123');
    });

    it('returns error when TKH Payments returns 4xx', async () => {
      nock(BASE_URL)
        .post('/intents')
        .reply(400, { message: 'Invalid currency' });

      const result = await client.createIntent({
        amount: 100,
        currency: 'XXX',
        metadata: { appId: 'kaba', referenceId: 'x', businessId: 'b' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid currency');
    });
  });

  describe('getPayConfig', () => {
    it('returns useKkiaPayWidget and useMomoRequest from TKH Payments', async () => {
      nock(BASE_URL)
        .get('/config')
        .query({ currency: 'XOF', country: 'BJ' })
        .reply(200, { useKkiaPayWidget: true, useMomoRequest: true });

      const result = await client.getPayConfig('XOF', 'BJ');

      expect(result.useKkiaPayWidget).toBe(true);
      expect(result.useMomoRequest).toBe(true);
    });

    it('returns false when neither option available', async () => {
      nock(BASE_URL)
        .get('/config')
        .query({ currency: 'USD' })
        .reply(200, { useKkiaPayWidget: false, useMomoRequest: false });

      const result = await client.getPayConfig('USD');

      expect(result.useKkiaPayWidget).toBe(false);
      expect(result.useMomoRequest).toBe(false);
    });
  });

  describe('requestMoMoPayment', () => {
    it('sends request to TKH Payments and returns success', async () => {
      nock(BASE_URL)
        .post('/intents/request-momo', (body) => {
          expect(body.amount).toBe(25000);
          expect(body.currency).toBe('XOF');
          expect(body.phone).toBe('+22997123456');
          expect(body.countryCode).toBe('BJ');
          expect(body.metadata.invoiceId).toBe('inv-002');
          return true;
        })
        .reply(200, { success: true });

      const result = await client.requestMoMoPayment({
        amount: 25000,
        currency: 'XOF',
        phone: '+22997123456',
        countryCode: 'BJ',
        metadata: {
          businessId: 'biz-001',
          invoiceId: 'inv-002',
          paymentIntentId: 'qb-biz-001-inv-002-123',
        },
      });

      expect(result.success).toBe(true);
    });

    it('returns error when TKH Payments indicates failure', async () => {
      nock(BASE_URL)
        .post('/intents/request-momo')
        .reply(200, { success: false, error: 'Insufficient funds' });

      const result = await client.requestMoMoPayment({
        amount: 999999999,
        currency: 'XOF',
        phone: '+22997123456',
        metadata: { invoiceId: 'inv-003' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient funds');
    });
  });

  describe('verifyKkiaPayTransaction', () => {
    it('returns success when transaction is valid', async () => {
      nock(BASE_URL)
        .post('/intents/verify-kkiapay', (body) => {
          expect(body.transactionId).toBe('kkiapay-tx-xyz');
          expect(body.intentId).toBe('intent-xyz');
          return true;
        })
        .reply(200, { verified: true });

      const result = await client.verifyKkiaPayTransaction('kkiapay-tx-xyz', 'intent-xyz');

      expect(result.success).toBe(true);
    });

    it('returns failure when transaction not found', async () => {
      nock(BASE_URL)
        .post('/intents/verify-kkiapay')
        .reply(200, { verified: false, error: 'Transaction not found' });

      const result = await client.verifyKkiaPayTransaction('invalid-tx', 'intent-abc');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
  });

  describe('disburse', () => {
    it('sends disbursement to TKH Payments and returns transactionId', async () => {
      nock(BASE_URL)
        .post('/disbursements', (body) => {
          expect(body.phone).toBe('+22997123456');
          expect(body.amount).toBe(15000);
          expect(body.currency).toBe('XOF');
          expect(body.externalId).toContain('qb-');
          expect(body.appId).toBe('kaba');
          expect(body.referenceId).toBe('qb-biz-001-sup-001-entry-001');
          return true;
        })
        .reply(200, { success: true, transactionId: 'disburse-tx-001' });

      const result = await client.disburse({
        phone: '+22997123456',
        amount: 15000,
        currency: 'XOF',
        externalId: 'qb-biz-001-sup-001-entry-001',
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('disburse-tx-001');
    });

    it('sends appId, referenceId, country when provided', async () => {
      nock(BASE_URL)
        .post('/disbursements', (body) => {
          expect(body.appId).toBe('kaba');
          expect(body.referenceId).toBe('payrun-123');
          expect(body.country).toBe('BJ');
          return true;
        })
        .reply(200, { success: true, transactionId: 'disb-2' });

      const result = await client.disburse({
        phone: '+22961234567',
        amount: 50000,
        currency: 'XOF',
        externalId: 'payroll-pr1-emp1',
        referenceId: 'payrun-123',
        country: 'BJ',
      });

      expect(result.success).toBe(true);
    });

    it('returns error when disbursement fails', async () => {
      nock(BASE_URL)
        .post('/disbursements')
        .reply(200, { success: false, error: 'Insufficient balance' });

      const result = await client.disburse({
        phone: '+22997123456',
        amount: 999999,
        currency: 'XOF',
        externalId: 'qb-x',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
    });
  });
});
