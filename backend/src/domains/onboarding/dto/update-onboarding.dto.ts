import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const ONBOARDING_STEPS = ['businessName', 'businessType', 'country', 'currency', 'taxRegime', 'details'] as const;

export class UpdateOnboardingDto {
  @IsOptional()
  @IsString()
  @IsIn(ONBOARDING_STEPS)
  step?: (typeof ONBOARDING_STEPS)[number];

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  taxRegime?: string;

  @IsOptional()
  @IsString()
  businessAddress?: string;

  @IsOptional()
  @IsString()
  businessPhone?: string;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  fiscalYearStart?: number;

  @IsOptional()
  @IsBoolean()
  onboardingComplete?: boolean;
}
