import {
  IsString,
  IsEmail,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  phone?: string;
}
