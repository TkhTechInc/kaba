import { Injectable, Inject } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { TaxEngineManager } from '@/domains/tax/TaxEngineManager';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import type { TaxableTransaction } from '@/domains/tax/ITaxEngine';
import { TAX_ENGINE } from '@/nest/modules/tax/tax.tokens';
import type { ITaxEngine } from '@/domains/tax/ITaxEngine';

@Injectable()
export class GetTaxEstimateTool implements IMcpTool {
  readonly name = 'get_tax_estimate';
  readonly description =
    'Calculate estimated VAT/tax liability for the current month based on recorded transactions';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'starter' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      countryCode: {
        type: 'string',
        description: "Country code for tax rules e.g. 'NG', 'BJ', 'GH' (default BJ)",
      },
    },
    required: [],
  };

  constructor(
    @Inject(TAX_ENGINE) private readonly taxEngine: ITaxEngine,
    private readonly ledgerRepository: LedgerRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const countryCode = (input.countryCode as string) ?? 'BJ';

    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const end = now.toISOString().slice(0, 10);

      const allEntries = await this.ledgerRepository.listAllByBusinessForBalance(ctx.businessId);
      const monthEntries = allEntries.filter((e) => e.date >= start && e.date <= end);

      const transactions: TaxableTransaction[] = monthEntries.map((e) => ({
        id: `${e.date}-${e.type}-${e.amount}`,
        amount: e.amount,
        currency: e.currency,
        type: e.type === 'sale' ? 'sale' : 'expense',
        isTaxInclusive: false,
      }));

      const summary = await this.taxEngine.calculateVAT(transactions, countryCode, { start, end });

      return {
        totalVAT: summary.totalVAT,
        totalSales: summary.totalSales,
        currency: summary.currency,
        period: summary.period,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
