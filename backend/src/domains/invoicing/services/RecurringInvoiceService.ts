import { Injectable } from '@nestjs/common';
import { RecurringInvoiceRepository } from '../repositories/RecurringInvoiceRepository';
import { InvoiceRepository } from '../repositories/InvoiceRepository';
import type {
  RecurringInvoiceSchedule,
  RecurrenceInterval,
} from '../models/RecurringInvoiceSchedule';
import { NotFoundError, ValidationError } from '@/shared/errors/DomainError';

function addIntervalToDate(baseDate: Date, interval: RecurrenceInterval): Date {
  const d = new Date(baseDate);
  switch (interval) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      return d;
    case 'monthly': {
      const targetMonth = d.getMonth() + 1;
      const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      d.setFullYear(targetYear, normalizedMonth, Math.min(d.getDate(), lastDay));
      return d;
    }
    case 'quarterly': {
      const targetMonth = d.getMonth() + 3;
      const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
      d.setFullYear(targetYear, normalizedMonth, Math.min(d.getDate(), lastDay));
      return d;
    }
    default:
      d.setMonth(d.getMonth() + 1);
      return d;
  }
}

@Injectable()
export class RecurringInvoiceService {
  constructor(
    private readonly recurringRepository: RecurringInvoiceRepository,
    private readonly invoiceRepository: InvoiceRepository
  ) {}

  async createSchedule(
    businessId: string,
    templateInvoiceId: string,
    interval: RecurrenceInterval,
    userId?: string
  ): Promise<RecurringInvoiceSchedule> {
    const template = await this.invoiceRepository.getById(
      businessId,
      templateInvoiceId
    );
    if (!template) {
      throw new NotFoundError('Invoice', templateInvoiceId);
    }
    if (template.status === 'cancelled') {
      throw new ValidationError(
        'Cannot create recurring schedule from cancelled invoice'
      );
    }

    const now = new Date();
    const nextRunAt = addIntervalToDate(now, interval).toISOString();

    return this.recurringRepository.create({
      businessId,
      templateInvoiceId,
      customerId: template.customerId,
      interval,
      nextRunAt,
      createdBy: userId,
    });
  }

  async processDueSchedules(): Promise<{
    processed: number;
    invoices: string[];
  }> {
    const now = new Date().toISOString();
    const schedules = await this.recurringRepository.listDueSchedules(now);
    const createdIds: string[] = [];

    for (const schedule of schedules) {
      try {
        const template = await this.invoiceRepository.getById(
          schedule.businessId,
          schedule.templateInvoiceId
        );
        if (!template) {
          console.warn(
            `[RecurringInvoiceService] Template ${schedule.templateInvoiceId} not found, skipping schedule ${schedule.id}`
          );
          continue;
        }

        const clonedInvoice = await this.invoiceRepository.create({
          businessId: template.businessId,
          customerId: template.customerId,
          amount: template.amount,
          currency: template.currency,
          items: template.items,
          dueDate: schedule.nextRunAt.slice(0, 10),
          status: 'draft',
          earlyPaymentDiscountPercent: template.earlyPaymentDiscountPercent,
          earlyPaymentDiscountDays: template.earlyPaymentDiscountDays,
        });

        createdIds.push(clonedInvoice.id);

        const nextRunAt = addIntervalToDate(
          new Date(schedule.nextRunAt),
          schedule.interval
        ).toISOString();
        const lastRunAt = new Date().toISOString();

        await this.recurringRepository.updateNextRun(
          schedule.businessId,
          schedule.id,
          nextRunAt,
          lastRunAt
        );
      } catch (e) {
        console.error(
          `[RecurringInvoiceService] Failed to process schedule ${schedule.id}:`,
          e
        );
      }
    }

    return { processed: schedules.length, invoices: createdIds };
  }

  async listByBusiness(businessId: string): Promise<RecurringInvoiceSchedule[]> {
    return this.recurringRepository.listByBusiness(businessId);
  }

  async cancelSchedule(businessId: string, scheduleId: string): Promise<void> {
    const schedule = await this.recurringRepository.getById(
      businessId,
      scheduleId
    );
    if (!schedule) {
      throw new NotFoundError('Recurring schedule', scheduleId);
    }
    await this.recurringRepository.setInactive(businessId, scheduleId);
  }
}
