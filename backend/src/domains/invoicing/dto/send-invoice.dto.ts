import { IsString } from 'class-validator';

export class SendInvoiceDto {
  @IsString()
  businessId!: string;
}
