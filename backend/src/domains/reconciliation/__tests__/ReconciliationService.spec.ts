import { ReconciliationService } from '../services/ReconciliationService';
import { MOBILE_MONEY_PARSER } from '../reconciliation.tokens';
import type { IMobileMoneyParser, ParsedMobileMoneyTransaction } from '../interfaces/IMobileMoneyParser';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { ValidationError } from '@/shared/errors/DomainError';
import { ConfigService } from '@nestjs/config';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParsedCredit(overrides: Partial<ParsedMobileMoneyTransaction> = {}): ParsedMobileMoneyTransaction {
  return {
    amount: 25000,
    currency: 'XOF',
    date: '2026-03-05',
    type: 'credit',
    reference: 'REF123',
    description: 'Payment from customer',
    ...overrides,
  };
}

function makeParsedDebit(overrides: Partial<ParsedMobileMoneyTransaction> = {}): ParsedMobileMoneyTransaction {
  return {
    amount: 5000,
    currency: 'XOF',
    date: '2026-03-05',
    type: 'debit',
    reference: 'WITHDRAW',
    ...overrides,
  };
}

const PRO_BUSINESS = {
  id: 'biz-001',
  businessId: 'biz-001',
  tier: 'pro' as const,
  currency: 'XOF',
  name: 'Marché Dantokpa',
  countryCode: 'BJ',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  onboardingComplete: true,
};

const LEDGER_ENTRY = {
  id: 'entry-001',
  businessId: 'biz-001',
  type: 'sale',
  amount: 25000,
  currency: 'XOF',
  description: 'Payment from customer',
  category: 'Mobile Money',
  date: '2026-03-05',
  createdAt: '2026-03-05T10:00:00.000Z',
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks(parserReturn: ParsedMobileMoneyTransaction) {
  const parser: jest.Mocked<IMobileMoneyParser> = {
    parse: jest.fn().mockResolvedValue(parserReturn),
  };

  const ledgerService = {
    createEntry: jest.fn().mockResolvedValue(LEDGER_ENTRY),
  } as unknown as jest.Mocked<LedgerService>;

  const businessRepo = {
    getOrCreate: jest.fn().mockResolvedValue(PRO_BUSINESS),
  } as unknown as jest.Mocked<BusinessRepository>;

  const featureService = new FeatureService(null as unknown as ConfigService);

  const usageRepo = {
    getMobileMoneyReconCount: jest.fn().mockResolvedValue(5),
    incrementMobileMoneyRecon: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<UsageRepository>;

  const invoiceService = {
    listUnpaid: jest.fn().mockResolvedValue([]),
    markPaidFromWebhook: jest.fn(),
  } as unknown as jest.Mocked<InvoiceService>;

  const service = new ReconciliationService(
    parser,
    ledgerService,
    businessRepo,
    featureService,
    usageRepo,
    invoiceService,
    undefined, // auditLogger
  );

  return {
    service,
    parser,
    ledgerService,
    businessRepo,
    usageRepo,
    invoiceService,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReconciliationService', () => {
  describe('reconcileFromSms', () => {
    it('parses SMS and creates ledger entry for credit', async () => {
      const parsed = makeParsedCredit();
      const { service, parser, ledgerService, usageRepo } = makeMocks(parsed);

      const result = await service.reconcileFromSms('biz-001', 'MTN MoMo: You received 25000 XOF from REF123');

      expect(parser.parse).toHaveBeenCalledWith('MTN MoMo: You received 25000 XOF from REF123');
      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-001',
          type: 'sale',
          amount: 25000,
          currency: 'XOF',
          date: '2026-03-05',
          description: 'Payment from customer',
          category: 'Mobile Money',
        }),
      );
      expect(usageRepo.incrementMobileMoneyRecon).toHaveBeenCalledWith('biz-001');
      expect(result.entry.id).toBe('entry-001');
      expect(result.parsed.amount).toBe(25000);
      expect(result.parsed.type).toBe('credit');
    });

    it('creates expense entry for debit transaction', async () => {
      const parsed = makeParsedDebit();
      const { service, parser, ledgerService } = makeMocks(parsed);

      const result = await service.reconcileFromSms('biz-001', 'MTN MoMo: You sent 5000 XOF');

      expect(parser.parse).toHaveBeenCalled();
      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'expense',
          amount: 5000,
          currency: 'XOF',
        }),
      );
      expect(result.parsed.type).toBe('debit');
    });

    it('uses reference when description is missing', async () => {
      const parsed = makeParsedCredit({ description: undefined, reference: 'TXN-456' });
      const { service, ledgerService } = makeMocks(parsed);

      await service.reconcileFromSms('biz-001', 'SMS text');

      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Mobile money: TXN-456',
        }),
      );
    });

    it('uses default description when neither description nor reference', async () => {
      const parsed = makeParsedCredit({ description: undefined, reference: undefined });
      const { service, ledgerService } = makeMocks(parsed);

      await service.reconcileFromSms('biz-001', 'SMS text');

      expect(ledgerService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Mobile money transaction',
        }),
      );
    });

    it('returns empty parsed when parser returns empty-like result', async () => {
      const parsed = makeParsedCredit({ amount: 0 });
      const { service } = makeMocks(parsed);

      const result = await service.reconcileFromSms('biz-001', 'Invalid SMS');

      expect(result.parsed.amount).toBe(0);
      expect(result.entry).toBeDefined();
    });

    it('throws ValidationError when mobile_money_recon feature not enabled', async () => {
      const parsed = makeParsedCredit();
      const { service, businessRepo } = makeMocks(parsed);
      (businessRepo.getOrCreate as jest.Mock).mockResolvedValue({
        ...PRO_BUSINESS,
        tier: 'free',
      });

      await expect(
        service.reconcileFromSms('biz-001', 'MTN MoMo: You received 25000 XOF'),
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when usage limit reached', async () => {
      const parsed = makeParsedCredit();
      const { service, usageRepo, businessRepo } = makeMocks(parsed);
      (usageRepo.getMobileMoneyReconCount as jest.Mock).mockResolvedValue(100);

      await expect(
        service.reconcileFromSms('biz-001', 'MTN MoMo: You received 25000 XOF'),
      ).rejects.toThrow(ValidationError);
    });
  });
});
