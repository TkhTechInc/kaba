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

  /** User's preferred locale (e.g. "fr") so the AI responds in that language. */
  @IsOptional()
  @IsString()
  locale?: string;
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

  @IsOptional()
  @IsString()
  locale?: string;
}

export class McpAdminChatDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
