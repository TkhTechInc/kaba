import { Injectable } from '@nestjs/common';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerService } from '@/domains/invoicing/services/CustomerService';
import { ProductService } from '@/domains/inventory/services/ProductService';
import { DashboardService } from '@/domains/dashboard/DashboardService';
import { DebtService } from '@/domains/debts/services/DebtService';

@Injectable()
export class MobileService {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly ledgerService: LedgerService,
    private readonly invoiceService: InvoiceService,
    private readonly customerService: CustomerService,
    private readonly productService: ProductService,
    private readonly debtService: DebtService,
  ) {}

  async getHome(businessId: string, _currency?: string) {
    const [
      dashboard,
      weeklyProfit,
      paymentsOverview,
      activityByType,
      recentLedger,
      sentInvoices,
      overdueInvoices,
      debtsResult,
    ] = await Promise.all([
      this.dashboardService.getSummary(businessId),
      this.dashboardService.getWeeksProfit(businessId),
      this.dashboardService.getPaymentsOverview(businessId, 'monthly'),
      this.dashboardService.getActivityByType(businessId, 'monthly'),
      this.ledgerService.listEntries(businessId, 1, 5),
      this.invoiceService.listByStatus(businessId, 'sent', 5),
      this.invoiceService.listByStatus(businessId, 'overdue', 5),
      this.debtService.list(businessId, 1, 10).catch(() => ({ items: [], total: 0 })),
    ]);

    const pendingInvoices = [...(sentInvoices.items ?? []), ...(overdueInvoices.items ?? [])].slice(0, 5);
    const debts = (debtsResult.items ?? []).filter((d) => d.status !== 'paid').slice(0, 5);

    return {
      dashboard,
      weeklyProfit,
      paymentsOverview,
      activityByType,
      recentLedger: { items: recentLedger.items ?? [], total: recentLedger.total ?? 0 },
      pendingInvoices: {
        items: pendingInvoices,
        total: (sentInvoices.items?.length ?? 0) + (overdueInvoices.items?.length ?? 0),
      },
      debts: { items: debts, total: debtsResult.total ?? 0 },
    };
  }

  async getSync(businessId: string, since: string) {
    const sinceDate = new Date(since);

    const [ledger, invoices, customers, products] = await Promise.all([
      this.ledgerService.listEntries(businessId, 1, 500),
      this.invoiceService.list(businessId, 1, 500),
      this.customerService.list(businessId, 1, 500),
      this.productService.list(businessId, 1, 500),
    ]);

    const ledgerItems = ledger.items ?? [];
    const invoiceItems = invoices.items ?? [];
    const customerItems = customers.items ?? [];
    const productItems = products.items ?? [];

    const afterSince = <T extends { createdAt?: string; deletedAt?: string }>(items: T[]) =>
      items.filter(
        (i) =>
          (i.createdAt && new Date(i.createdAt) >= sinceDate) ||
          (i.deletedAt && new Date(i.deletedAt) >= sinceDate),
      );

    const deletedAfter = <T extends { id: string; deletedAt?: string }>(items: T[]) =>
      items.filter((i) => i.deletedAt && new Date(i.deletedAt) >= sinceDate).map((i) => i.id);

    return {
      syncedAt: new Date().toISOString(),
      ledgerEntries: afterSince(ledgerItems),
      invoices: afterSince(invoiceItems),
      customers: afterSince(customerItems),
      products: afterSince(productItems),
      deletedIds: {
        ledgerEntries: deletedAfter(ledgerItems),
        invoices: deletedAfter(invoiceItems),
        customers: deletedAfter(customerItems),
        products: deletedAfter(productItems),
      },
    };
  }
}
