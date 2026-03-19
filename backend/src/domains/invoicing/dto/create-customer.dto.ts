import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @ValidateIf((o) => (o.email ?? '').trim() !== '')
  @IsEmail({}, { message: 'email must be a valid email address when provided' })
  @MaxLength(200)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  phone?: string;
}
