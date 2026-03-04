import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { WebhookRepository } from './repositories/WebhookRepository';
import { WebhookService } from './WebhookService';
import { WebhookController } from './WebhookController';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '../access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';

@Module({
  imports: [AuditModule, AccessModule, BusinessModule],
  controllers: [WebhookController],
  providers: [
    {
      provide: WebhookRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new WebhookRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    WebhookService,
  ],
  exports: [WebhookService],
})
export class WebhookModule {}
