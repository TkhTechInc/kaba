import { Injectable } from '@nestjs/common';
import type {
  PLReport,
  CashFlowSummary,
  BalanceSheetReport,
} from './ReportService';

/** Escapes a value for CSV: wrap in quotes if contains comma or quote; escape " as "". */
function escapeCsv(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Builds a CSV row from values. */
function row(...values: (string | number)[]): string {
  return values.map(escapeCsv).join(',');
}

@Injectable()
export class ReportCsvService {
  /**
   * P&L CSV: summary section + by-category section.
   * Headers: Period Start, Period End, Total Income, Total Expenses, Net Profit, Currency.
   * Second section: Category, Type, Amount.
   */
  generatePLCsv(report: PLReport): string {
    const lines: string[] = [];

    lines.push(row('Period Start', 'Period End', 'Total Income', 'Total Expenses', 'Net Profit', 'Currency'));
    lines.push(
      row(
        report.period.start,
        report.period.end,
        report.totalIncome,
        report.totalExpenses,
        report.netProfit,
        report.currency,
      ),
    );

    lines.push('');
    lines.push(row('Category', 'Type', 'Amount'));
    for (const { category, amount, type } of report.byCategory) {
      lines.push(row(category, type, amount));
    }

    return lines.join('\n');
  }

  /**
   * Cash Flow CSV: summary + optional daily breakdown.
   * Summary: Period, Opening Balance, Total Inflows, Total Outflows, Closing Balance.
   * If daily exists: Date, Inflow, Outflow, Balance.
   */
  generateCashFlowCsv(report: CashFlowSummary): string {
    const lines: string[] = [];

    const periodLabel = `${report.period.start} to ${report.period.end}`;
    lines.push(row('Period', 'Opening Balance', 'Total Inflows', 'Total Outflows', 'Closing Balance', 'Currency'));
    lines.push(
      row(
        periodLabel,
        report.openingBalance,
        report.totalInflows,
        report.totalOutflows,
        report.closingBalance,
        report.currency,
      ),
    );

    if (report.daily && report.daily.length > 0) {
      lines.push('');
      lines.push(row('Date', 'Inflow', 'Outflow', 'Balance'));
      for (const { date, inflow, outflow, balance } of report.daily) {
        lines.push(row(date, inflow, outflow, balance));
      }
    }

    return lines.join('\n');
  }

  /**
   * Balance Sheet CSV: As Of Date, Cash, Receivables, Total Assets, Payables,
   * Total Liabilities, Retained Earnings, Total Equity, Balanced.
   */
  generateBalanceSheetCsv(report: BalanceSheetReport): string {
    const lines: string[] = [];

    lines.push(
      row(
        'As Of Date',
        'Cash',
        'Receivables',
        'Total Assets',
        'Payables',
        'Total Liabilities',
        'Retained Earnings',
        'Total Equity',
        'Balanced',
      ),
    );
    lines.push(
      row(
        report.asOfDate,
        report.assets.cash,
        report.assets.receivables,
        report.totalAssets,
        report.liabilities.payables,
        report.liabilities.total,
        report.equity.retainedEarnings,
        report.equity.total,
        report.balanced ? 'Yes' : 'No',
      ),
    );

    return lines.join('\n');
  }
}
