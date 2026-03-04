import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { ReportService } from './ReportService';
import { PdfExportService } from './PdfExportService';
import { ReportController } from './ReportController';

@Module({
  imports: [AccessModule, BusinessModule, DebtModule],
  controllers: [ReportController],
  providers: [
    PdfExportService,
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ReportService,
  ],
  exports: [ReportService, LedgerRepository],
})
export class ReportModule {}
