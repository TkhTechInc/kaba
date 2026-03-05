import { IsString, IsNumber, Min, Max, Matches, ValidateIf } from 'class-validator';

export class MoMoUploadDto {
  @IsString()
  businessId!: string;

  @IsString()
  smsText!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be in YYYY-MM format' })
  month!: string; // YYYY-MM

  @IsNumber()
  @Min(0)
  declaredTotal!: number;

  @IsString()
  currency!: string;
}

export class TrustScoreQueryDto {
  @IsString()
  businessId!: string;
}

export class TrustLookupDto {
  @ValidateIf(o => !o.businessPhone)
  @IsString()
  businessId?: string;

  @ValidateIf(o => !o.businessId)
  @IsString()
  businessPhone?: string;
}

export class UpdateMarketDayDto {
  @IsString()
  businessId!: string;

  @IsNumber()
  @Min(1)
  @Max(30)
  marketDayCycle!: number;
}
