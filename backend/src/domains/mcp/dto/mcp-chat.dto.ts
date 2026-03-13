import { IsString, IsOptional } from 'class-validator';
import type { Tier } from '@/domains/features/feature.types';

export class McpChatDto {
  @IsString()
  businessId!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  tier?: Tier;
}

export class McpPortalChatDto {
  @IsString()
  businessId!: string;

  @IsString()
  customerEmail!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class McpAdminChatDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
