import type { Tier } from '@/domains/features/feature.types';

export type McpScope = 'business' | 'customer' | 'admin';

export interface McpToolContext {
  businessId: string;
  userId?: string;
  customerEmail?: string;
  tier: Tier;
  scope: McpScope;
}

export interface IMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly scopes: readonly McpScope[];
  readonly tierRequired: Tier;
  execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown>;
}
