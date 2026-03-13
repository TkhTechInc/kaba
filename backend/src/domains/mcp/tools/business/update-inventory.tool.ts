import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { ProductService } from '@/domains/inventory/services/ProductService';

@Injectable()
export class UpdateInventoryTool implements IMcpTool {
  readonly name = 'update_inventory';
  readonly description = 'Add or remove stock for a product. Use operation=add to restock, subtract to reduce after a sale.';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      productName: { type: 'string', description: 'Name of the product to update' },
      quantityDelta: { type: 'number', description: 'Quantity to add or subtract (positive number)' },
      operation: {
        type: 'string',
        enum: ['add', 'subtract'],
        description: 'Whether to add or subtract stock',
      },
    },
    required: ['productName', 'quantityDelta', 'operation'],
  };

  constructor(private readonly productService: ProductService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const productName = input.productName as string;
    const quantityDelta = input.quantityDelta as number;
    const operation = input.operation as 'add' | 'subtract';

    const result = await this.productService.list(ctx.businessId, 1, 50);
    const product = result.items.find((p) =>
      p.name.toLowerCase().includes(productName.toLowerCase()),
    );

    if (!product) {
      return {
        error: `Product not found: ${productName}. Use check_stock to see available products.`,
      };
    }

    let updatedProduct;
    if (operation === 'subtract') {
      updatedProduct = await this.productService.decrementStock(ctx.businessId, product.id, quantityDelta);
    } else {
      updatedProduct = await this.productService.update(
        ctx.businessId,
        product.id,
        { quantityInStock: (product.quantityInStock ?? 0) + quantityDelta },
        ctx.userId,
      );
    }

    return {
      productName: product.name,
      operation,
      quantityDelta,
      newStock: updatedProduct?.quantityInStock ?? null,
    };
  }
}
