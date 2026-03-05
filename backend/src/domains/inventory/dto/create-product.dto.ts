import { IsString, IsNumber, IsOptional, Min, MaxLength, IsIn } from 'class-validator';

const CURRENCIES = ['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'] as const;

export class CreateProductDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsString()
  @IsIn([...CURRENCIES])
  currency!: string;

  @IsNumber()
  @Min(0)
  quantityInStock!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  lowStockThreshold?: number;
}
