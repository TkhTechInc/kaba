import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';

@Injectable()
export class GenerateTaxReportTool implements IMcpTool {
  readonly name = 'generate_tax_report';
  readonly description =
    'Generate a tax report for a given period showing sales, purchases, VAT collected, and VAT paid';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
      endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
      includeVAT: { type: 'boolean', description: 'Include VAT calculations (default true)' },
      vatRate: { type: 'number', description: 'VAT rate as percentage, e.g. 18 for 18% (default 18)' },
    },
    required: ['startDate', 'endDate'],
  };

  constructor(
    private readonly ledgerRepo: LedgerRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const startDate = input.startDate as string;
    const endDate = input.endDate as string;
    const includeVAT = input.includeVAT !== false;
    const vatRate = (input.vatRate as number) ?? 18;

    // Get all ledger entries for the period
    const entries = await this.ledgerRepo.listByBusinessAndDateRange(
      ctx.businessId,
      startDate,
      endDate,
    );

    // Get all invoices for the period
    const invoices = await this.invoiceRepo.listByBusinessAndDateRange(
      ctx.businessId,
      startDate,
      endDate,
    );

    // Calculate totals
    let totalSales = 0;
    let totalExpenses = 0;
    let cashSales = 0;
    let invoicedSales = 0;

    for (const entry of entries) {
      if (entry.type === 'sale') {
        totalSales += entry.amount;
        cashSales += entry.amount;
      } else {
        totalExpenses += entry.amount;
      }
    }

    // Add invoice sales
    for (const invoice of invoices) {
      if (invoice.status === 'paid') {
        invoicedSales += invoice.amount;
        totalSales += invoice.amount;
      }
    }

    const netIncome = totalSales - totalExpenses;
    const vatCollected = includeVAT ? (totalSales * vatRate) / (100 + vatRate) : 0;
    const vatPaid = includeVAT ? (totalExpenses * vatRate) / (100 + vatRate) : 0;
    const vatDue = vatCollected - vatPaid;

    return {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalSales,
        cashSales,
        invoicedSales,
        totalExpenses,
        netIncome,
        transactionCount: entries.length,
        invoiceCount: invoices.length,
      },
      vat: includeVAT
        ? {
            rate: vatRate,
            collected: Math.round(vatCollected * 100) / 100,
            paid: Math.round(vatPaid * 100) / 100,
            due: Math.round(vatDue * 100) / 100,
          }
        : null,
      salesBreakdown: {
        cash: Math.round(cashSales * 100) / 100,
        invoiced: Math.round(invoicedSales * 100) / 100,
      },
    };
  }
}
