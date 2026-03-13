import { IsString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ListInvoicesQueryDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX)
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_REGEX)
  toDate?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}
