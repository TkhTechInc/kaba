import { IsString, IsArray, IsOptional, IsBoolean, IsIn } from 'class-validator';

const VALID_SCOPES = [
  'ledger:read',
  'ledger:write',
  'invoices:read',
  'invoices:write',
  'webhooks:read',
  'webhooks:write',
  'api_keys:read',
  'api_keys:write',
] as const;

export class CreateApiKeyDto {
  @IsString()
  businessId!: string;

  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @IsIn(VALID_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}
