import { IsString, IsOptional } from 'class-validator';

export class VoiceCommandDto {
  @IsString()
  businessId!: string;

  @IsString()
  phone!: string;

  @IsString()
  text!: string;

  @IsString()
  @IsOptional()
  audioBase64?: string;
}
