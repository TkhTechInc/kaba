import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ProductService } from '@/domains/inventory/services/ProductService';

@Injectable()
export class CheckStockTool implements IMcpTool {
  readonly name = 'check_stock';
  readonly description = 'Check current inventory stock levels';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max products to return (default 20, max 50)' },
    },
    required: [],
  };

  constructor(private readonly productService: ProductService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const limit = Math.min((input.limit as number) ?? 20, 50);
    const result = await this.productService.list(ctx.businessId, 1, limit);
    return result.items.map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand ?? null,
      stock: product.quantityInStock,
      lowStockThreshold: product.lowStockThreshold ?? null,
      price: product.unitPrice,
      currency: product.currency,
    }));
  }
}
