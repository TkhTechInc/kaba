import { Injectable } from '@nestjs/common';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerService } from '@/domains/invoicing/services/CustomerService';
import { ReportService } from '@/domains/reports/ReportService';

export interface DashboardSummary {
  balance: number;
  currency: string;
  ledgerEntriesCount: number;
  invoicesCount: number;
  customersCount: number;
}

export interface PaymentsOverviewData {
  received: Array<{ x: string; y: number }>;
  due: Array<{ x: string; y: number }>;
  currency: string;
}

export interface WeeksProfitData {
  sales: Array<{ x: string; y: number }>;
  revenue: Array<{ x: string; y: number }>;
}

export type ActivityByTypeData = Array<{ name: string; amount: number }>;

@Injectable()
export class DashboardService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly invoiceService: InvoiceService,
    private readonly customerService: CustomerService,
    private readonly reportService: ReportService,
  ) {}

  async getSummary(businessId: string): Promise<DashboardSummary> {
    const [balanceRes, ledgerCount, invoiceCount, customerCount] = await Promise.all([
      this.ledgerService.getBalance(businessId),
      this.ledgerService.countEntries(businessId),
      this.invoiceService.count(businessId),
      this.customerService.count(businessId),
    ]);

    return {
      balance: balanceRes.balance,
      currency: balanceRes.currency,
      ledgerEntriesCount: ledgerCount,
      invoicesCount: invoiceCount,
      customersCount: customerCount,
    };
  }

  async getPaymentsOverview(
    businessId: string,
    timeFrame: 'monthly' | 'yearly' = 'monthly',
  ): Promise<PaymentsOverviewData> {
    const now = new Date();
    const currency = (await this.ledgerService.getBalance(businessId)).currency;

    if (timeFrame === 'yearly') {
      const years = 5;
      const unpaid = await this.invoiceService.listUnpaid(businessId);

      const yearRanges = Array.from({ length: years }, (_, i) => {
        const y = now.getFullYear() - (years - 1 - i);
        return { y, from: `${y}-01-01`, to: `${y}-12-31` };
      });

      const cashFlows = await Promise.all(
        yearRanges.map(({ from, to }) => this.reportService.getCashFlow(businessId, from, to)),
      );

      const received = yearRanges.map(({ y, from, to }, i) => ({
        x: String(y),
        y: cashFlows[i].totalInflows,
      }));
      const due = yearRanges.map(({ y, from, to }) => ({
        x: String(y),
        y: unpaid
          .filter((inv) => inv.dueDate >= from && inv.dueDate <= to)
          .reduce((sum, inv) => sum + inv.amount, 0),
      }));
      return { received, due, currency };
    }

    const months = 12;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const unpaid = await this.invoiceService.listUnpaid(businessId);

    const monthRanges = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { m, from, to };
    });

    const cashFlows = await Promise.all(
      monthRanges.map(({ from, to }) => this.reportService.getCashFlow(businessId, from, to)),
    );

    const received = monthRanges.map(({ m }, i) => ({
      x: monthNames[m],
      y: cashFlows[i].totalInflows,
    }));
    const due = monthRanges.map(({ m, from, to }) => {
      const monthDue = unpaid
        .filter((inv) => inv.dueDate >= from && inv.dueDate <= to)
        .reduce((sum, inv) => sum + inv.amount, 0);
      return { x: monthNames[m], y: monthDue };
    });
    return { received, due, currency };
  }

  async getWeeksProfit(
    businessId: string,
    timeFrame: 'this week' | 'last week' = 'this week',
  ): Promise<WeeksProfitData> {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOffset = timeFrame === 'this week' ? -dayOfWeek : -dayOfWeek - 7;
    const start = new Date(now);
    start.setDate(now.getDate() + startOffset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const from = start.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);
    const cf = await this.reportService.getCashFlow(businessId, from, to);

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyMap = new Map<string, { inflow: number; outflow: number }>();
    for (const d of dayLabels) dailyMap.set(d, { inflow: 0, outflow: 0 });

    for (const row of cf.daily ?? []) {
      const date = new Date(row.date);
      const label = dayLabels[date.getDay()];
      const cur = dailyMap.get(label)!;
      cur.inflow += row.inflow;
      cur.outflow += row.outflow;
    }

    const sales = dayLabels.map((x) => ({ x, y: dailyMap.get(x)!.inflow }));
    const revenue = dayLabels.map((x) => ({ x, y: dailyMap.get(x)!.outflow }));
    return { sales, revenue };
  }

  async getActivityByType(
    businessId: string,
    timeFrame: 'monthly' | 'yearly' = 'monthly',
  ): Promise<ActivityByTypeData> {
    const now = new Date();
    let from: string;
    let to: string;

    if (timeFrame === 'yearly') {
      const y = now.getFullYear() - 1;
      from = `${y}-01-01`;
      to = `${y}-12-31`;
    } else {
      const y = now.getFullYear();
      const m = now.getMonth();
      from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    const cf = await this.reportService.getCashFlow(businessId, from, to);
    return [
      { name: 'Sales', amount: Math.round(cf.totalInflows) },
      { name: 'Expenses', amount: Math.round(cf.totalOutflows) },
    ];
  }
}
