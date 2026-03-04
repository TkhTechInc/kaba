import { IsString, IsOptional, MaxLength } from 'class-validator';

export class MobileMoneyReconDto {
  @IsString()
  businessId!: string;

  @IsString()
  @MaxLength(2000)
  smsText!: string;
}
