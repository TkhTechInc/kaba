import {
  IsString,
  IsOptional,
  IsNumber,
  IsBase64,
  MaxLength,
  IsIn,
  Matches,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AIQueryDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(2000)
  query!: string;
}

export class CashFlowForecastDto {
  @IsString()
  businessId!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate!: string;

  @IsOptional()
  @IsNumber()
  days?: number;
}

export class VoiceToTransactionDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsBase64()
  audioBase64?: string;

  @IsOptional()
  @IsString()
  @IsIn(['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'])
  currency?: string;
}

export class LoanReadinessDto {
  @IsString()
  businessId!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' })
  toDate!: string;
}
