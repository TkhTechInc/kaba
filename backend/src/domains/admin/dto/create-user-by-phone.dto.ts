import { IsString, IsOptional, IsIn, Matches, MinLength } from 'class-validator';

export class CreateUserByPhoneDto {
  @IsString()
  @MinLength(10, { message: 'Phone number must be at least 10 digits' })
  @Matches(/^[+]?[\d\s-]+$/, { message: 'Invalid phone number format' })
  phone!: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';
}
