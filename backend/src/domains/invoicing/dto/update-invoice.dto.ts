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

export class UpdateInvoiceItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0.01, { message: 'Unit price must be greater than zero' })
  unitPrice!: number;

  @IsNumber()
  @Min(0.01, { message: 'Line item amount must be greater than zero' })
  amount!: number;
}

export class UpdateInvoiceDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.01, { message: 'Invoice total amount must be greater than zero' })
  amount?: number;

  @IsString()
  @IsOptional()
  @IsIn(['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'])
  currency?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateInvoiceItemDto)
  items?: UpdateInvoiceItemDto[];

  @IsString()
  @IsOptional()
  dueDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  earlyPaymentDiscountPercent?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  earlyPaymentDiscountDays?: number;
}
