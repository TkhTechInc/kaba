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
}
