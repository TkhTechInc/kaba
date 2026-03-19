import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  IsNotEmpty,
  Min,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 4217: 3-letter currency code (case-insensitive, normalized to uppercase) */
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

export class CreateLedgerEntryDto {
  @IsString()
  @IsNotEmpty({ message: 'businessId is required' })
  businessId!: string;

  @IsIn(['sale', 'expense'])
  type!: 'sale' | 'expense';

  /** Required when productId not provided. When productId provided, computed from product. */
  @ValidateIf((o) => !o.productId)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(CURRENCY_PATTERN, { message: 'currency must be a 3-letter ISO code (e.g. XOF, NGN)' })
  currency!: string;

  /** Optional when productId provided (computed as "{productName} x {quantitySold}"). */
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

  /** Product ID for inventory-based sale. When set, quantitySold required, amount/description computed. */
  @IsOptional()
  @IsString()
  productId?: string;

  /** Quantity sold when productId provided. */
  @ValidateIf((o) => !!o.productId)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantitySold?: number;

  /** Original currency for multi-currency entries. */
  @IsOptional()
  @IsString()
  originalCurrency?: string;

  /** Exchange rate (1 originalCurrency = X ledger currency). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  exchangeRate?: number;

  /** Forex gain/loss in ledger currency. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  forexGainLoss?: number;
}
