import { IsString, IsBoolean } from 'class-validator';

export class ErasureDto {
  @IsString()
  businessId!: string;

  @IsBoolean()
  confirm!: boolean;
}
