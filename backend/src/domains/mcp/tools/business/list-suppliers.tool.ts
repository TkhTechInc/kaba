import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { SupplierService } from '@/domains/suppliers/services/SupplierService';

@Injectable()
export class ListSuppliersTool implements IMcpTool {
  readonly name = 'list_suppliers';
  readonly description = 'List all suppliers for the business';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {},
    required: [],
  };

  constructor(private readonly supplierService: SupplierService) {}

  async execute(_input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    return this.supplierService.list(ctx.businessId);
  }
}
