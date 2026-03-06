import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { ReportService } from './ReportService';
import { ReportCsvService } from './ReportCsvService';
import { PdfExportService } from './PdfExportService';
import { ReportController } from './ReportController';
import { ConsolidatedReportService } from './ConsolidatedReportService';
import { CreditScoreService } from './CreditScoreService';

@Module({
  imports: [AccessModule, BusinessModule, DebtModule],
  controllers: [ReportController],
  providers: [
    ReportCsvService,
    PdfExportService,
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: DebtRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new DebtRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ReportService,
    ConsolidatedReportService,
    CreditScoreService,
  ],
  exports: [ReportService, LedgerRepository, ConsolidatedReportService, CreditScoreService],
})
export class ReportModule {}
