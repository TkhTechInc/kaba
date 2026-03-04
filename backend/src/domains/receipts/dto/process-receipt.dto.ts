import {
  IsString,
  IsOptional,
  IsBase64,
  MaxLength,
  IsIn,
} from 'class-validator';

const MAX_BASE64_LENGTH = 7_000_000; // ~5MB as base64

export class ProcessReceiptDto {
  @IsOptional()
  @IsBase64()
  @MaxLength(MAX_BASE64_LENGTH)
  imageBase64?: string;

  @IsOptional()
  @IsString()
  s3Key?: string;

  @IsString()
  businessId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['NGN', 'GHS', 'XOF', 'XAF', 'USD', 'EUR'])
  currency?: string;
}
