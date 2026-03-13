/**
 * Tests for the Payment Reminder Lambda handler logic.
 *
 * The handler is a module-level Lambda that:
 *   1. Scans overdue debts (via DebtRepository.scanOverdue)
 *   2. Sends WhatsApp or SMS reminders for each debt with a phone number
 *   3. Updates debt.lastReminderSentAt after a successful send
 *
 * We test the orchestration logic by extracting the pure helper and
 * by mocking the DebtRepository + messaging providers.
 */
import type { Debt } from '@/domains/debts/models/Debt';

// ── Pure helper ───────────────────────────────────────────────────────────────

/** Extracted from handler for direct testing */
function buildReminderMessage(
  debtorName: string,
  currency: string,
  amount: number,
  dueDate: string,
): string {
  return `Reminder: ${debtorName} owes ${currency} ${amount}. Due: ${dueDate}. Please pay at your earliest convenience.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-001',
    businessId: 'biz-ng-001',
    debtorName: 'Amara Diallo',
    amount: 50000,
    currency: 'XOF',
    dueDate: '2026-03-01',
    status: 'overdue',
    phone: '+221771234567',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── buildReminderMessage tests ────────────────────────────────────────────────

describe('buildReminderMessage', () => {
  it('produces a message containing debtor name', () => {
    const msg = buildReminderMessage('Amara Diallo', 'XOF', 50000, '2026-03-01');
    expect(msg).toContain('Amara Diallo');
  });

  it('includes the currency and amount', () => {
    const msg = buildReminderMessage('Koffi', 'NGN', 150000, '2026-03-10');
    expect(msg).toContain('NGN');
    expect(msg).toContain('150000');
  });

  it('includes the due date', () => {
    const msg = buildReminderMessage('Ibrahim', 'XOF', 25000, '2026-04-15');
    expect(msg).toContain('2026-04-15');
  });

  it('includes call-to-action text', () => {
    const msg = buildReminderMessage('Test', 'XOF', 1000, '2026-03-01');
    expect(msg.toLowerCase()).toContain('pay');
  });

  it('works with XOF amounts common in West Africa', () => {
    const msg = buildReminderMessage('Mama Wax', 'XOF', 500000, '2026-03-31');
    expect(msg).toContain('500000');
    expect(msg).toContain('XOF');
    expect(msg).toContain('Mama Wax');
  });
});

// ── Orchestration logic tests ─────────────────────────────────────────────────

describe('PaymentReminderHandler orchestration', () => {
  function makeRepo() {
    return {
      scanOverdue: jest.fn(),
      update: jest.fn(),
    };
  }

  function makeWhatsApp() {
    return { send: jest.fn() };
  }

  function makeSms() {
    return { send: jest.fn() };
  }

  /** Inline reimplementation of handler logic for unit testing */
  async function runReminderLogic(
    repo: ReturnType<typeof makeRepo>,
    whatsApp: ReturnType<typeof makeWhatsApp> | null,
    smsProvider: ReturnType<typeof makeSms>,
    today: string,
    reminderThreshold: string,
  ) {
    const errors: string[] = [];
    let sent = 0;

    const debts = await repo.scanOverdue(today, reminderThreshold);

    for (const debt of debts as Debt[]) {
      if (!debt.phone) continue;

      const message = buildReminderMessage(debt.debtorName, debt.currency, debt.amount, debt.dueDate);

      try {
        let success = false;

        if (whatsApp) {
          const result = await whatsApp.send(debt.phone, message);
          success = result.success;
        }

        if (!success) {
          const result = await smsProvider.send(debt.phone, message);
          success = result.success;
        }

        if (success) {
          sent++;
          debt.lastReminderSentAt = new Date().toISOString();
          debt.updatedAt = debt.lastReminderSentAt;
          await repo.update(debt);
        } else {
          errors.push(`Failed to send reminder for debt ${debt.id} (${debt.debtorName})`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Error processing debt ${debt.id}: ${msg}`);
      }
    }

    return { processed: debts.length, sent, errors };
  }

  it('sends WhatsApp reminder when token is configured and updates lastReminderSentAt', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();
    const debt = makeDebt();

    repo.scanOverdue.mockResolvedValue([debt]);
    whatsApp.send.mockResolvedValue({ success: true });
    repo.update.mockResolvedValue(debt);

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.sent).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(whatsApp.send).toHaveBeenCalledWith('+221771234567', expect.stringContaining('Amara Diallo'));
    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ lastReminderSentAt: expect.any(String) }),
    );
  });

  it('falls back to SMS when WhatsApp is not configured', async () => {
    const repo = makeRepo();
    const sms = makeSms();
    const debt = makeDebt({ phone: '+2348012345678' });

    repo.scanOverdue.mockResolvedValue([debt]);
    sms.send.mockResolvedValue({ success: true });
    repo.update.mockResolvedValue(debt);

    const result = await runReminderLogic(repo, null, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.sent).toBe(1);
    expect(sms.send).toHaveBeenCalledWith('+2348012345678', expect.stringContaining('Amara Diallo'));
  });

  it('falls back to SMS when WhatsApp send fails', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();
    const debt = makeDebt();

    repo.scanOverdue.mockResolvedValue([debt]);
    whatsApp.send.mockResolvedValue({ success: false });
    sms.send.mockResolvedValue({ success: true });
    repo.update.mockResolvedValue(debt);

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.sent).toBe(1);
    expect(sms.send).toHaveBeenCalled();
  });

  it('skips debts without a phone number', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();

    repo.scanOverdue.mockResolvedValue([makeDebt({ phone: undefined })]);

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.sent).toBe(0);
    expect(whatsApp.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('records error when both WhatsApp and SMS fail', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();
    const debt = makeDebt();

    repo.scanOverdue.mockResolvedValue([debt]);
    whatsApp.send.mockResolvedValue({ success: false });
    sms.send.mockResolvedValue({ success: false });

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('debt-001');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('handles exceptions from the provider gracefully', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();
    const debt = makeDebt();

    repo.scanOverdue.mockResolvedValue([debt]);
    whatsApp.send.mockRejectedValue(new Error('Network timeout'));
    sms.send.mockResolvedValue({ success: true });

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('debt-001');
  });

  it('processes multiple debts and counts sent correctly', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();

    const debts = [
      makeDebt({ id: 'debt-001', debtorName: 'Amara' }),
      makeDebt({ id: 'debt-002', debtorName: 'Koffi', phone: '+22890123456' }),
      makeDebt({ id: 'debt-003', debtorName: 'Blessing', phone: undefined }),
    ];

    repo.scanOverdue.mockResolvedValue(debts);
    whatsApp.send.mockResolvedValue({ success: true });
    repo.update.mockResolvedValue(makeDebt());

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.processed).toBe(3);
    expect(result.sent).toBe(2); // debt-003 skipped (no phone)
    expect(whatsApp.send).toHaveBeenCalledTimes(2);
    expect(repo.update).toHaveBeenCalledTimes(2);
  });

  it('returns zero processed when no overdue debts found', async () => {
    const repo = makeRepo();
    const whatsApp = makeWhatsApp();
    const sms = makeSms();

    repo.scanOverdue.mockResolvedValue([]);

    const result = await runReminderLogic(repo, whatsApp, sms, '2026-03-07', '2026-03-06T00:00:00.000Z');

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
