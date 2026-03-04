import { Injectable } from '@nestjs/common';
import { LedgerService } from '@/domains/ledger/services/LedgerService';
import { InvoiceService } from '@/domains/invoicing/services/InvoiceService';
import { CustomerService } from '@/domains/invoicing/services/CustomerService';

export interface DashboardSummary {
  balance: number;
  currency: string;
  ledgerEntriesCount: number;
  invoicesCount: number;
  customersCount: number;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly invoiceService: InvoiceService,
    private readonly customerService: CustomerService,
  ) {}

  async getSummary(businessId: string): Promise<DashboardSummary> {
    const [balanceRes, ledgerRes, invoiceRes, customerRes] = await Promise.all([
      this.ledgerService.getBalance(businessId),
      this.ledgerService.listEntries(businessId, 1, 1),
      this.invoiceService.list(businessId, 1, 1),
      this.customerService.list(businessId, 1, 1),
    ]);

    return {
      balance: balanceRes.balance,
      currency: balanceRes.currency,
      ledgerEntriesCount: ledgerRes.total,
      invoicesCount: invoiceRes.total,
      customersCount: customerRes.total,
    };
  }
}
