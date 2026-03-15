import { IsOptional, IsString, IsBoolean, IsIn, MaxLength } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['en', 'fr'])
  locale?: 'en' | 'fr';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  smsReminders?: boolean;

  /** Default business for chat/USSD when user has multiple businesses */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  defaultBusinessId?: string;
}
