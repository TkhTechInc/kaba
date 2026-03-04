import { IsString, IsNumber, IsOptional, IsIn, Min, MaxLength, Matches } from 'class-validator';

const CURRENCIES = ['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateDebtDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(200)
  debtorName!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsIn(CURRENCIES)
  currency!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
