export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly';

export interface RecurringInvoiceSchedule {
  id: string;
  businessId: string;
  templateInvoiceId: string;
  customerId: string;
  interval: RecurrenceInterval;
  nextRunAt: string;
  lastRunAt?: string;
  createdAt: string;
  createdBy?: string;
  isActive: boolean;
}
