import { IsString, IsOptional } from 'class-validator';

export class MobileHomeQueryDto {
  @IsString()
  businessId!: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
