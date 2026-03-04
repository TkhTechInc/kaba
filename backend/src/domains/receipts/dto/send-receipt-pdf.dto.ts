import { IsString, IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SendReceiptPdfItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  total!: number;
}

export class SendReceiptPdfDto {
  @IsString()
  businessId!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsNumber()
  total!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendReceiptPdfItemDto)
  items?: SendReceiptPdfItemDto[];
}
