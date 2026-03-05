import { IsString, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  phone!: string;

  @IsString()
  @IsOptional()
  otp?: string;

  @IsString()
  @IsOptional()
  password?: string;
}
