import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

const CURRENCIES = ['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLedgerEntryDto {
  @IsString()
  businessId!: string;

  @IsIn(['sale', 'expense'])
  type!: 'sale' | 'expense';

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsIn(CURRENCIES)
  currency!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  category?: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsString()
  smsPhone?: string;
}
