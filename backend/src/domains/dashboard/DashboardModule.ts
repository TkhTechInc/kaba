import { Module } from '@nestjs/common';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { DashboardController } from './DashboardController';
import { DashboardService } from './DashboardService';

@Module({
  imports: [LedgerModule, InvoiceModule, AccessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
