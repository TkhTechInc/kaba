import { IsString, IsUrl, IsArray, IsIn } from 'class-validator';

const VALID_EVENTS = [
  'ledger.entry.created',
  'ledger.entry.deleted',
  'invoice.paid',
  'invoice.created',
  'payment.received',
] as const;

export class CreateWebhookDto {
  @IsString()
  businessId!: string;

  @IsUrl({ protocols: ['https:'] })
  url!: string;

  @IsString()
  secret!: string;

  @IsArray()
  @IsString({ each: true })
  @IsIn(VALID_EVENTS, { each: true })
  events!: string[];
}
