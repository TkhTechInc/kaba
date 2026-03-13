import { IsNumber, IsString, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class PaySupplierDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
