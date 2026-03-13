import { Injectable } from '@nestjs/common';
import { AuditRepository } from '@/domains/audit/repositories/AuditRepository';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';

@Injectable()
export class QueryAuditLogsTool implements IMcpTool {
  readonly name = 'query_audit_logs';
  readonly description = 'Query audit logs for a specific business to review actions and changes';
  readonly scopes = ['admin'] as const;
  readonly tierRequired = 'enterprise' as const;
  readonly inputSchema: Record<string, unknown> = {
    type: 'object',
    properties: {
      businessId: { type: 'string', description: 'Business ID to query' },
      limit: { type: 'number', description: 'Max results (default 20)' },
      fromDate: { type: 'string', description: 'Start date ISO 8601' },
    },
    required: ['businessId'],
  };

  constructor(private readonly auditRepository: AuditRepository) {}

  async execute(input: Record<string, unknown>, _ctx: McpToolContext): Promise<unknown> {
    const businessId = input['businessId'] as string;
    const limit = Math.min(Number(input['limit'] ?? 20), 100);
    const fromDate = input['fromDate'] as string | undefined;

    const { items } = await this.auditRepository.queryByBusiness(
      businessId,
      fromDate,
      undefined,
      limit,
    );
    return items;
  }
}
