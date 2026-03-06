import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '@/domains/audit/AuditModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { AuditRepository } from '@/domains/audit/repositories/AuditRepository';
import { ComplianceService } from './ComplianceService';
import { ComplianceController } from './ComplianceController';

@Module({
  imports: [AuditModule, AccessModule],
  controllers: [ComplianceController],
  providers: [
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: InvoiceRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.invoicesTable') ?? 'Kaba-Invoices-dev';
        return new InvoiceRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: CustomerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.invoicesTable') ?? 'Kaba-Invoices-dev';
        return new CustomerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: AuditRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.auditLogsTable') ?? 'Kaba-AuditLogs-dev-audit';
        const retentionDays =
          config.get<number>('compliance.auditRetentionDays') ?? 365;
        return new AuditRepository(docClient, tableName, retentionDays);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ComplianceService,
  ],
  exports: [ComplianceService],
})
export class ComplianceModule {}
