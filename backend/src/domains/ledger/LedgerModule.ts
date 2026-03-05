import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { WebhookModule } from '@/domains/webhooks/WebhookModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { InventoryModule } from '@/domains/inventory/InventoryModule';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { LedgerRepository } from './repositories/LedgerRepository';
import { LedgerService, EVENT_BRIDGE_CLIENT } from './services/LedgerService';
import { LedgerController } from './LedgerController';

@Module({
  imports: [NotificationsModule, BusinessModule, InventoryModule, AuditModule, AccessModule, WebhookModule],
  controllers: [LedgerController],
  providers: [
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: EVENT_BRIDGE_CLIENT,
      useFactory: () => new EventBridgeClient({}),
    },
    LedgerService,
  ],
  exports: [LedgerService, LedgerRepository],
})
export class LedgerModule {}
