import { Module } from '@nestjs/common';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { InventoryModule } from '@/domains/inventory/InventoryModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { DashboardService } from '@/domains/dashboard/DashboardService';
import { MobileController } from './MobileController';
import { MobileService } from './MobileService';

/**
 * Module exports audit:
 *   LedgerModule  → exports LedgerService ✓
 *   InvoiceModule → exports InvoiceService, CustomerService ✓
 *   InventoryModule → exports ProductService ✓
 *   ReportModule  → exports ReportService ✓ (required by DashboardService)
 *   DebtModule    → exports DebtService ✓
 *
 * DashboardModule does NOT export DashboardService.
 * DashboardService is registered as a local provider here instead.
 */
@Module({
  imports: [LedgerModule, InvoiceModule, InventoryModule, ReportModule, DebtModule],
  controllers: [MobileController],
  providers: [MobileService, DashboardService],
})
export class MobileModule {}
