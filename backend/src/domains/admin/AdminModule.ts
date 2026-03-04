import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { ReceiptModule } from '@/domains/receipts/ReceiptModule';
import { AuditModule } from '@/domains/audit/AuditModule';
import { AIModule } from '@/nest/modules/ai/ai.module';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { AdminController } from './AdminController';
import { AdminMetricsService } from './AdminMetricsService';
import { AdminAIQueryService } from './AdminAIQueryService';
import { AdminGuard } from './AdminGuard';

@Module({
  imports: [LedgerModule, ReceiptModule, AuditModule, AIModule, BusinessModule],
  controllers: [AdminController],
  providers: [
    AdminGuard,
    AdminMetricsService,
    AdminAIQueryService,
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: UserRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new UserRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
})
export class AdminModule {}
