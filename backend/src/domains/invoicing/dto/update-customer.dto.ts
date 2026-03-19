import { IsString, IsEmail, IsOptional, ValidateIf } from 'class-validator';

export class UpdateCustomerDto {
  @IsString()
  businessId!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @ValidateIf((o) => (o.email ?? '').trim() !== '')
  @IsEmail({}, { message: 'email must be a valid email address when provided' })
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
