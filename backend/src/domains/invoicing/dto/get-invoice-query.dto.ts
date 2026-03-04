import { IsString } from 'class-validator';

export class GetInvoiceQueryDto {
  @IsString()
  businessId!: string;
}
