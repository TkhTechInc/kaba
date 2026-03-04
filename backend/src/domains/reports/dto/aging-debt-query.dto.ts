import { IsOptional, IsString, Matches } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AgingDebtQueryDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate?: string;
}
