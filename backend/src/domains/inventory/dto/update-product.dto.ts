import { IsString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  businessId!: string;


  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  unitPrice?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  quantityInStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  lowStockThreshold?: number;
}
