import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { DebtModule } from '@/domains/debts/DebtModule';
import { DebtRepository } from '@/domains/debts/repositories/DebtRepository';
import { InvoiceRepository } from '@/domains/invoicing/repositories/InvoiceRepository';
import { CustomerRepository } from '@/domains/invoicing/repositories/CustomerRepository';
import { UsageModule } from '@/domains/usage/UsageModule';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { AccessModule } from '@/domains/access/AccessModule';
import { MoMoReconciliationService } from './MoMoReconciliationService';
import { BusinessTrustScoreService } from './BusinessTrustScoreService';
import { TrustShareService } from './TrustShareService';
import { TrustController } from './TrustController';

@Module({
  imports: [BusinessModule, LedgerModule, DebtModule, UsageModule, AccessModule],
  controllers: [TrustController],
  providers: [
    {
      provide: MoMoReconciliationService,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new MoMoReconciliationService(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: InvoiceRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'Kaba-Invoices-dev';
        return new InvoiceRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: CustomerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.invoicesTable') ?? 'Kaba-Invoices-dev';
        return new CustomerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    BusinessTrustScoreService,
    {
      provide: TrustShareService,
      useFactory: (
        docClient: DynamoDBDocumentClient,
        config: ConfigService,
        trustScoreService: BusinessTrustScoreService,
        businessRepo: BusinessRepository,
      ) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        const baseUrl = config.get<string>('app.baseUrl') ?? 'http://localhost:3001';
        return new TrustShareService(docClient, tableName, trustScoreService, businessRepo, baseUrl);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService, BusinessTrustScoreService, BusinessRepository],
    },
  ],
  exports: [BusinessTrustScoreService, MoMoReconciliationService],
})
export class TrustModule {}
