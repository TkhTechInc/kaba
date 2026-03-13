import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { SupplierPaymentService } from '@/domains/suppliers/services/SupplierPaymentService';

@Injectable()
export class PaySupplierTool implements IMcpTool {
  readonly name = 'pay_supplier';
  readonly description = 'Pay a supplier via mobile money disbursement and record the expense';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      supplierId: { type: 'string', description: 'Supplier ID' },
      amount: { type: 'number', description: 'Amount to pay' },
      currency: { type: 'string', description: 'Currency code e.g. XOF, GHS, NGN (default XOF)' },
      description: { type: 'string', description: 'Payment description / reference' },
    },
    required: ['supplierId', 'amount'],
  };

  constructor(private readonly supplierPaymentService: SupplierPaymentService) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const result = await this.supplierPaymentService.paySupplier(
      ctx.businessId,
      input.supplierId as string,
      input.amount as number,
      (input.currency as string) ?? 'XOF',
      input.description as string | undefined,
    );
    return { success: result.success, ledgerEntryId: result.ledgerEntryId };
  }
}
