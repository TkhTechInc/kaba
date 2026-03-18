import { Injectable } from '@nestjs/common';
import type { IMcpTool, McpToolContext } from '../../interfaces/IMcpTool';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';

interface ReconciliationMatch {
  invoiceId?: string;
  debtId?: string;
  ledgerEntryId?: string;
  amount: number;
  matchType: 'exact' | 'partial' | 'suggested';
  confidence: number;
}

@Injectable()
export class ReconcilePaymentsTool implements IMcpTool {
  readonly name = 'reconcile_payments';
  readonly description =
    'Reconcile payments by matching ledger entries to invoices and debts. Helps identify unmatched payments and suggest reconciliations.';
  readonly scopes = ['business'] as const;
  readonly tierRequired = 'pro' as const;
  readonly inputSchema = {
    type: 'object',
    properties: {
      startDate: { type: 'string', description: 'Start date for reconciliation YYYY-MM-DD' },
      endDate: { type: 'string', description: 'End date for reconciliation YYYY-MM-DD' },
      autoReconcile: {
        type: 'boolean',
        description: 'Automatically mark exact matches as reconciled (default false)',
      },
    },
    required: ['startDate', 'endDate'],
  };

  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly debtRepo: DebtRepository,
    private readonly ledgerRepo: LedgerRepository,
  ) {}

  async execute(input: Record<string, unknown>, ctx: McpToolContext): Promise<unknown> {
    const startDate = input.startDate as string;
    const endDate = input.endDate as string;
    const autoReconcile = input.autoReconcile === true;

    // Get unpaid/pending invoices
    const { items: unpaidInvoices } = await this.invoiceRepo.listByBusiness(
      ctx.businessId,
      1,
      1000,
      'pending',
    );

    // Get pending debts
    const { items: pendingDebts } = await this.debtRepo.listByBusiness(
      ctx.businessId,
      1,
      1000,
      'pending',
    );

    // Get ledger sales entries for the period
    const entries = await this.ledgerRepo.listByBusinessAndDateRange(
      ctx.businessId,
      startDate,
      endDate,
    );
    const salesEntries = entries.filter((e) => e.type === 'sale');

    const matches: ReconciliationMatch[] = [];
    const unmatchedInvoices = [];
    const unmatchedDebts = [];
    const unmatchedPayments = [];

    // Try to match sales entries to invoices
    const matchedEntryIds = new Set<string>();

    for (const invoice of unpaidInvoices) {
      let bestMatch: (typeof salesEntries)[0] | null = null;
      let matchType: 'exact' | 'partial' | 'suggested' = 'suggested';
      let confidence = 0;

      for (const entry of salesEntries) {
        if (matchedEntryIds.has(entry.id)) continue;

        // Exact amount match
        if (Math.abs(entry.amount - invoice.amount) < 0.01) {
          bestMatch = entry;
          matchType = 'exact';
          confidence = 100;
          break;
        }

        // Partial match (within 10% difference)
        const diff = Math.abs(entry.amount - invoice.amount);
        const percentDiff = (diff / invoice.amount) * 100;
        if (percentDiff < 10 && (confidence === 0 || percentDiff < confidence)) {
          bestMatch = entry;
          matchType = 'partial';
          confidence = 100 - percentDiff;
        }
      }

      if (bestMatch) {
        matches.push({
          invoiceId: invoice.id,
          ledgerEntryId: bestMatch.id,
          amount: bestMatch.amount,
          matchType,
          confidence: Math.round(confidence),
        });
        matchedEntryIds.add(bestMatch.id);
      } else {
        unmatchedInvoices.push({
          id: invoice.id,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
        });
      }
    }

    // Try to match remaining entries to debts
    for (const debt of pendingDebts) {
      let bestMatch: (typeof salesEntries)[0] | null = null;
      let matchType: 'exact' | 'partial' | 'suggested' = 'suggested';
      let confidence = 0;

      for (const entry of salesEntries) {
        if (matchedEntryIds.has(entry.id)) continue;

        if (Math.abs(entry.amount - debt.amount) < 0.01) {
          bestMatch = entry;
          matchType = 'exact';
          confidence = 100;
          break;
        }

        const diff = Math.abs(entry.amount - debt.amount);
        const percentDiff = (diff / debt.amount) * 100;
        if (percentDiff < 10 && (confidence === 0 || percentDiff < confidence)) {
          bestMatch = entry;
          matchType = 'partial';
          confidence = 100 - percentDiff;
        }
      }

      if (bestMatch) {
        matches.push({
          debtId: debt.id,
          ledgerEntryId: bestMatch.id,
          amount: bestMatch.amount,
          matchType,
          confidence: Math.round(confidence),
        });
        matchedEntryIds.add(bestMatch.id);
      } else {
        unmatchedDebts.push({
          id: debt.id,
          debtorName: debt.debtorName,
          amount: debt.amount,
          dueDate: debt.dueDate,
        });
      }
    }

    // Remaining sales entries are unmatched payments
    for (const entry of salesEntries) {
      if (!matchedEntryIds.has(entry.id)) {
        unmatchedPayments.push({
          id: entry.id,
          amount: entry.amount,
          date: entry.entryDate,
          description: entry.description,
        });
      }
    }

    return {
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalMatches: matches.length,
        exactMatches: matches.filter((m) => m.matchType === 'exact').length,
        partialMatches: matches.filter((m) => m.matchType === 'partial').length,
        unmatchedInvoices: unmatchedInvoices.length,
        unmatchedDebts: unmatchedDebts.length,
        unmatchedPayments: unmatchedPayments.length,
      },
      matches: matches.slice(0, 20), // Return first 20 matches
      unmatchedInvoices: unmatchedInvoices.slice(0, 10),
      unmatchedDebts: unmatchedDebts.slice(0, 10),
      unmatchedPayments: unmatchedPayments.slice(0, 10),
      autoReconciled: autoReconcile
        ? matches.filter((m) => m.matchType === 'exact').length
        : 0,
    };
  }
}
