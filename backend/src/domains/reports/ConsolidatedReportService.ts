import { Injectable } from '@nestjs/common';
import { ReportService, PLReport } from './ReportService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { Business } from '@/domains/ledger/models/Business';
import { getBusinessCurrency } from '@/shared/utils/country-currency';

export interface BranchPLReport {
  businessId: string;
  businessName?: string;
  currency: string;
  report: PLReport;
  /** Converted amounts in the org's base currency */
  convertedIncome: number;
  convertedExpenses: number;
  exchangeRate: number;
}

export interface ConsolidatedPLReport {
  organizationId: string;
  period: { start: string; end: string };
  baseCurrency: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  /** @deprecated Use baseCurrency */
  currency: string;
  branches: BranchPLReport[];
}

/**
 * Indicative West Africa exchange rates relative to XOF (FCFA).
 * These are baseline rates — update periodically or swap with a live FX provider.
 * Source: approximate mid-market rates Q1 2026.
 *
 * All values = 1 unit of the foreign currency expressed in XOF.
 */
const XOF_RATES: Record<string, number> = {
  XOF: 1,
  XAF: 1,         // CFA franc BEAC — pegged 1:1 with XOF
  NGN: 0.44,      // 1 NGN ≈ 0.44 XOF  (≈ 1555 NGN/EUR vs 655 XOF/EUR)
  GHS: 43,        // 1 GHS ≈ 43 XOF
  GMD: 9.5,       // 1 GMD ≈ 9.5 XOF
  SLL: 0.025,     // 1 SLL ≈ 0.025 XOF (Sierra Leone leone)
  GNF: 0.075,     // 1 GNF ≈ 0.075 XOF (Guinean franc)
  MRU: 17,        // 1 MRU ≈ 17 XOF (Mauritanian ouguiya)
  LRD: 3.5,       // 1 LRD ≈ 3.5 XOF (Liberian dollar)
  CVE: 6.6,       // 1 CVE ≈ 6.6 XOF (Cape Verde escudo)
  USD: 600,       // 1 USD ≈ 600 XOF
  EUR: 655.957,   // 1 EUR = 655.957 XOF (fixed peg)
  GBP: 780,       // 1 GBP ≈ 780 XOF
};

/**
 * Convert an amount from `fromCurrency` to `toCurrency` using XOF as the pivot.
 * Returns the original amount unchanged if either currency is unknown.
 */
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): { converted: number; rate: number } {
  if (fromCurrency === toCurrency) return { converted: amount, rate: 1 };
  const fromRate = XOF_RATES[fromCurrency.toUpperCase()];
  const toRate = XOF_RATES[toCurrency.toUpperCase()];
  if (!fromRate || !toRate) {
    // Unknown currency — pass through as-is, rate = 0 signals unconverted
    return { converted: amount, rate: 0 };
  }
  const inXOF = amount * fromRate;
  const converted = inXOF / toRate;
  const rate = fromRate / toRate;
  return { converted, rate };
}

/**
 * Determine the base (reporting) currency for the org.
 * Uses XOF if branches are mixed; otherwise uses the common currency.
 */
function resolveBaseCurrency(currencies: string[]): string {
  const unique = [...new Set(currencies.filter(Boolean))];
  if (unique.length === 1) return unique[0];
  // Mixed currencies — default to XOF as the regional anchor
  return 'XOF';
}

@Injectable()
export class ConsolidatedReportService {
  constructor(
    private readonly reportService: ReportService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  async getConsolidatedPL(
    organizationId: string,
    fromDate: string,
    toDate: string,
  ): Promise<ConsolidatedPLReport> {
    const businesses: Business[] = await this.businessRepository.listByOrganization(organizationId);

    const branchReports = await Promise.all(
      businesses.map(async (biz): Promise<BranchPLReport> => {
        const report = await this.reportService.getPL(biz.id, fromDate, toDate);
        const branchCurrency = report.currency ?? getBusinessCurrency(biz);
        return {
          businessId: biz.id,
          businessName: biz.name,
          currency: branchCurrency,
          report,
          // filled in after base currency is determined
          convertedIncome: report.totalIncome,
          convertedExpenses: report.totalExpenses,
          exchangeRate: 1,
        };
      })
    );

    const baseCurrency = resolveBaseCurrency(branchReports.map((b) => b.currency));

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const branch of branchReports) {
      if (branch.currency !== baseCurrency) {
        const { converted: income, rate } = convertCurrency(branch.report.totalIncome, branch.currency, baseCurrency);
        const { converted: expenses } = convertCurrency(branch.report.totalExpenses, branch.currency, baseCurrency);
        branch.convertedIncome = Math.round(income * 100) / 100;
        branch.convertedExpenses = Math.round(expenses * 100) / 100;
        branch.exchangeRate = Math.round(rate * 10000) / 10000;
      }
      totalIncome += branch.convertedIncome;
      totalExpenses += branch.convertedExpenses;
    }

    totalIncome = Math.round(totalIncome * 100) / 100;
    totalExpenses = Math.round(totalExpenses * 100) / 100;
    const netProfit = Math.round((totalIncome - totalExpenses) * 100) / 100;

    return {
      organizationId,
      period: { start: fromDate, end: toDate },
      baseCurrency,
      currency: baseCurrency,
      totalIncome,
      totalExpenses,
      netProfit,
      branches: branchReports,
    };
  }
}
