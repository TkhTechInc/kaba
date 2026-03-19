import { IsString, IsOptional, IsNumber } from 'class-validator';

export class RefundInvoiceDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
