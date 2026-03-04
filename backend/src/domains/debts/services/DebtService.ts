import { Injectable, Inject, Optional } from '@nestjs/common';
import { DebtRepository } from '../repositories/DebtRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { WHATSAPP_PROVIDER } from '@/domains/notifications/notification.tokens';
import type { IWhatsAppProvider } from '@/domains/notifications/IWhatsAppProvider';
import { SmsService } from '@/domains/notifications/SmsService';
import { ValidationError } from '@/shared/errors/DomainError';
import type { Debt, CreateDebtInput } from '../models/Debt';
import type { ListDebtsResult } from '../repositories/DebtRepository';

@Injectable()
export class DebtService {
  constructor(
    private readonly debtRepo: DebtRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly featureService: FeatureService,
    private readonly smsService: SmsService,
    @Optional() @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider?: IWhatsAppProvider,
  ) {}

  async create(input: CreateDebtInput): Promise<Debt> {
    const business = await this.businessRepo.getOrCreate(input.businessId, 'free');
    if (!this.featureService.isEnabled('debt_tracker', business.tier)) {
      throw new ValidationError('Debt tracker is not available for your plan');
    }

    return this.debtRepo.create(input);
  }

  async list(
    businessId: string,
    page: number = 1,
    limit: number = 20,
    status?: Debt['status'],
  ): Promise<ListDebtsResult> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('debt_tracker', business.tier)) {
      throw new ValidationError('Debt tracker is not available for your plan');
    }

    return this.debtRepo.listByBusiness(businessId, page, limit, status);
  }

  async getById(businessId: string, id: string): Promise<Debt | null> {
    return this.debtRepo.getById(businessId, id);
  }

  async markPaid(businessId: string, id: string): Promise<Debt | null> {
    return this.debtRepo.updateStatus(businessId, id, 'paid');
  }

  async sendReminder(businessId: string, id: string): Promise<{ sent: boolean; channel?: 'sms' | 'whatsapp' }> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('debt_reminders', business.tier)) {
      throw new ValidationError('Debt reminders are not available for your plan');
    }

    const debt = await this.debtRepo.getById(businessId, id);
    if (!debt) {
      throw new ValidationError('Debt not found');
    }
    if (!debt.phone?.trim()) {
      throw new ValidationError('No phone number for this debtor. Add a phone number to send reminders.');
    }
    if (debt.status === 'paid') {
      throw new ValidationError('Cannot send reminder for a paid debt');
    }

    const message = this.formatReminderMessage(debt);

    // Prefer WhatsApp if configured, else SMS
    if (this.whatsappProvider) {
      const result = await this.whatsappProvider.send(debt.phone.trim(), message);
      return { sent: result.success, channel: 'whatsapp' };
    }

    const result = await this.smsService.send(debt.phone.trim(), message);
    return { sent: result.success, channel: 'sms' };
  }

  private formatReminderMessage(debt: Debt): string {
    return `Reminder: ${debt.debtorName} owes ${debt.currency} ${debt.amount.toLocaleString()}. Due: ${debt.dueDate}. Please pay at your earliest convenience.`;
  }
}
