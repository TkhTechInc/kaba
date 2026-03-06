import { Injectable, Inject, Optional } from '@nestjs/common';
import { DebtRepository } from '../repositories/DebtRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { FeatureService } from '@/domains/features/FeatureService';
import { WHATSAPP_PROVIDER } from '@/domains/notifications/notification.tokens';
import type { IWhatsAppProvider } from '@/domains/notifications/IWhatsAppProvider';
import { SmsService } from '@/domains/notifications/SmsService';
import { ValidationError, NotFoundError } from '@/shared/errors/DomainError';
import type { Debt, CreateDebtInput } from '../models/Debt';
import type { ListDebtsResult } from '../repositories/DebtRepository';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';

@Injectable()
export class DebtService {
  constructor(
    private readonly debtRepo: DebtRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly featureService: FeatureService,
    private readonly smsService: SmsService,
    @Optional() @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider?: IWhatsAppProvider,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async create(input: CreateDebtInput, userId?: string): Promise<Debt> {
    const business = await this.businessRepo.getOrCreate(input.businessId, 'free');
    if (!this.featureService.isEnabled('debt_tracker', business.tier)) {
      throw new ValidationError('Debt tracker is not available for your plan');
    }

    const debt = await this.debtRepo.create(input);

    if (this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'debt',
        entityId: debt.id,
        businessId: debt.businessId,
        action: 'create',
        userId,
      }).catch(() => {});
    }

    return debt;
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
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('debt_tracker', business.tier)) {
      throw new ValidationError('Debt tracker is not available for your plan');
    }
    return this.debtRepo.getById(businessId, id);
  }

  async markPaid(businessId: string, id: string, userId?: string): Promise<Debt | null> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('debt_tracker', business.tier)) {
      throw new ValidationError('Debt tracker is not available for your plan');
    }
    const updated = await this.debtRepo.updateStatus(businessId, id, 'paid');

    if (updated && this.auditLogger && userId) {
      this.auditLogger.log({
        entityType: 'debt',
        entityId: id,
        businessId,
        action: 'update',
        userId,
        metadata: { statusChange: 'paid' },
      }).catch(() => {});
    }

    return updated;
  }

  async sendReminder(businessId: string, id: string): Promise<{ sent: boolean; channel?: 'sms' | 'whatsapp' }> {
    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    if (!this.featureService.isEnabled('debt_reminders', business.tier)) {
      throw new ValidationError('Debt reminders are not available for your plan');
    }

    const debt = await this.debtRepo.getById(businessId, id);
    if (!debt) {
      throw new NotFoundError('Debt', id);
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
    return `Reminder: ${debt.debtorName} owes ${debt.currency} ${debt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due: ${debt.dueDate}. Please pay at your earliest convenience.`;
  }
}
