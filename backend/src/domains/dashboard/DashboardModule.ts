import { Module } from '@nestjs/common';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { DashboardController } from './DashboardController';
import { DashboardService } from './DashboardService';

@Module({
  imports: [LedgerModule, InvoiceModule, ReportModule, AccessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
