import { IsString, IsIn } from 'class-validator';
import type { RecurrenceInterval } from '../models/RecurringInvoiceSchedule';

export class CreateRecurringScheduleDto {
  @IsString()
  businessId!: string;

  @IsString()
  templateInvoiceId!: string;

  @IsString()
  @IsIn(['weekly', 'monthly', 'quarterly'])
  interval!: RecurrenceInterval;
}

export class CancelRecurringScheduleDto {
  @IsString()
  businessId!: string;
}
