import { IsString, IsEmail, IsOptional } from 'class-validator';

export class UpdateCustomerDto {
  @IsString()
  businessId!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
