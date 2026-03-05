import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateInvoiceDto {
  @IsString()
  businessId!: string;

  @IsString()
  customerId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsIn(['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'])
  currency!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsString()
  dueDate!: string;

  @IsString()
  @IsOptional()
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  @IsNumber()
  @IsOptional()
  @Min(0)
  earlyPaymentDiscountPercent?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  earlyPaymentDiscountDays?: number;
}
