import { IsString, IsISO8601 } from 'class-validator';

export class MobileSyncQueryDto {
  @IsString()
  businessId!: string;

  @IsISO8601()
  since!: string;
}
