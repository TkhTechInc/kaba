import { Module } from '@nestjs/common';
import { ReportModule } from '@/domains/reports/ReportModule';
import { TrustModule } from '@/domains/trust/TrustModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { ComplianceModule } from '@/domains/compliance/ComplianceModule';
import { RegulatoryReportService } from './services/RegulatoryReportService';
import { RegulatoryController } from './RegulatoryController';

@Module({
  imports: [ReportModule, TrustModule, InvoiceModule, BusinessModule, ComplianceModule],
  controllers: [RegulatoryController],
  providers: [RegulatoryReportService],
  exports: [RegulatoryReportService],
})
export class RegulatoryModule {}
