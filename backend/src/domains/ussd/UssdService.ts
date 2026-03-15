import { Injectable } from '@nestjs/common';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import { AccessService } from '@/domains/access/AccessService';
import { pickBusinessForUser } from '@/domains/access/user-business-resolver';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';

const NO_ACCOUNT_MSG =
  'END No account linked to this phone. Please register at app.sika.app';

@Injectable()
export class UssdService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly accessService: AccessService,
    private readonly ledgerRepo: LedgerRepository,
    private readonly debtRepo: DebtRepository,
  ) {}

  /**
   * Handle USSD session. Africa's Talking sends sessionId, serviceCode, phoneNumber, text.
   * text is empty on first request; subsequent requests contain user input (e.g. "1" or "1*2").
   */
  async handleSession(
    _sessionId: string,
    _serviceCode: string,
    phoneNumber: string,
    text: string | undefined,
  ): Promise<string> {
    const input = (text ?? '').trim();
    const parts = input ? input.split('*') : [];

    // Level 0: no input — show main menu
    if (parts.length === 0) {
      return [
        'CON Welcome to Kaba',
        '1. Check Balance',
        '2. Today\'s Revenue',
        '3. Top Debtors',
        '4. Exit',
      ].join('\n');
    }

    const choice = parts[0];
    switch (choice) {
      case '1':
        return this.getBalance(phoneNumber);
      case '2':
        return this.getTodayRevenue(phoneNumber);
      case '3':
        return this.getTopDebtors(phoneNumber, 5);
      case '4':
        return 'END Thank you';
      default:
        return 'END Invalid option. Dial again to retry.';
    }
  }

  private async resolveBusinessId(phoneNumber: string): Promise<string | null> {
    const user = await this.userRepo.getByPhone(phoneNumber);
    if (!user) return null;

    const businesses = await this.accessService.listBusinessesForUser(user.id);
    if (!businesses.length) return null;

    return pickBusinessForUser(user, businesses);
  }

  async getBalance(phoneNumber: string): Promise<string> {
    const businessId = await this.resolveBusinessId(phoneNumber);
    if (!businessId) return NO_ACCOUNT_MSG;

    const result = await this.ledgerRepo.getRunningBalance(businessId);
    const balance = result?.balance ?? 0;
    const currency = result?.currency ?? 'NGN';

    return `END Balance: ${currency} ${this.formatAmount(balance)}`;
  }

  async getTodayRevenue(phoneNumber: string): Promise<string> {
    const businessId = await this.resolveBusinessId(phoneNumber);
    if (!businessId) return NO_ACCOUNT_MSG;

    const today = new Date().toISOString().slice(0, 10);
    const entries = await this.ledgerRepo.listByBusinessAndDateRange(
      businessId,
      today,
      today,
    );

    const revenue = entries
      .filter((e) => e.type === 'sale')
      .reduce((sum, e) => sum + e.amount, 0);

    const currency = entries[0]?.currency ?? 'NGN';

    return `END Today's Revenue: ${currency} ${this.formatAmount(revenue)}`;
  }

  async getTopDebtors(phoneNumber: string, limit = 5): Promise<string> {
    const businessId = await this.resolveBusinessId(phoneNumber);
    if (!businessId) return NO_ACCOUNT_MSG;

    const debts = await this.debtRepo.listByBusinessForAging(businessId);
    const sorted = debts
      .filter((d) => d.status === 'pending' || d.status === 'overdue')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    if (sorted.length === 0) {
      return 'END No pending debts.';
    }

    const lines = sorted.map(
      (d, i) =>
        `${i + 1}. ${d.debtorName}: ${d.currency} ${this.formatAmount(d.amount)}`,
    );
    return `END Top Debtors:\n${lines.join('\n')}`;
  }

  private formatAmount(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
