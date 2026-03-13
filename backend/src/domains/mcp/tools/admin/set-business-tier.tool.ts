import { Injectable } from '@nestjs/common';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { Tier } from '@/domains/features/feature.types';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

const VALID_TIERS: Tier[] = ['free', 'starter', 'pro', 'enterprise'];

@Injectable()
export class SetBusinessTierTool implements IMcpTool {
  readonly name = 'set_business_tier';
  readonly description = 'Override the subscription tier for a business (admin use only)';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      businessId: { type: 'string', description: 'Business ID' },
      tier: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'], description: 'New tier' },
    },
    required: ['businessId', 'tier'],
  };

  constructor(private readonly businessRepository: BusinessRepository) {}

  async execute(input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    const businessId = input['businessId'] as string;
    const tier = input['tier'] as string;

    if (!VALID_TIERS.includes(tier as Tier)) {
      throw new Error(`Invalid tier: ${tier}. Must be one of ${VALID_TIERS.join(', ')}`);
    }

    await this.businessRepository.updateTier(businessId, tier as Tier);
    return { businessId, tier, updatedAt: new Date().toISOString() };
  }
}
