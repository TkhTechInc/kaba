import { Module, forwardRef } from '@nestjs/common';
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
import { AIModule } from '@/nest/modules/ai/ai.module';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type { ICategorySuggester } from './interfaces/ICategorySuggester';
import { LedgerRepository } from './repositories/LedgerRepository';
import { LedgerService, EVENT_BRIDGE_CLIENT, CATEGORY_SUGGESTER } from './services/LedgerService';
import { LedgerController } from './LedgerController';
import { LLMCategorySuggester } from './services/LLMCategorySuggester';
import { KeywordCategorySuggester } from './services/KeywordCategorySuggester';

@Module({
  imports: [
    forwardRef(() => AIModule),
    NotificationsModule,
    BusinessModule,
    forwardRef(() => InventoryModule),
    AuditModule,
    AccessModule,
    WebhookModule,
  ],
  controllers: [LedgerController],
  providers: [
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: EVENT_BRIDGE_CLIENT,
      useFactory: () => new EventBridgeClient({}),
    },
    {
      provide: CATEGORY_SUGGESTER,
      useFactory: (config: ConfigService, llm: ILLMProvider | null): ICategorySuggester => {
        const provider =
          config.get<string>('ai.provider') || process.env['AI_PROVIDER'] || '';
        if (provider.trim() && llm) {
          return new LLMCategorySuggester(llm);
        }
        return new KeywordCategorySuggester();
      },
      inject: [ConfigService, { token: AI_LLM_PROVIDER, optional: true }],
    },
    LedgerService,
  ],
  exports: [LedgerService, LedgerRepository],
})
export class LedgerModule {}
