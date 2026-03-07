import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBModule, DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AIModule } from '@/nest/modules/ai/ai.module';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { TrustModule } from '@/domains/trust/TrustModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { IntentParserService } from './services/IntentParserService';
import { DynamoConversationStore } from './services/DynamoConversationStore';
import { ChatOrchestrator } from './services/ChatOrchestrator';
import { MockChannel } from './providers/MockChannel';
import { WhatsAppChannel } from './providers/WhatsAppChannel';
import { TelegramChannel } from './providers/TelegramChannel';

export const CONVERSATION_STORE = 'IConversationStore';
export const INTENT_PARSER = 'IIntentParser';
export const MESSAGING_CHANNELS = 'MESSAGING_CHANNELS';

@Module({
  imports: [
    DynamoDBModule,
    forwardRef(() => AIModule),
    LedgerModule,
    InvoiceModule,
    DebtModule,
    TrustModule,
    ReportModule,
  ],
  providers: [
    IntentParserService,
    { provide: INTENT_PARSER, useExisting: IntentParserService },
    {
      provide: DynamoConversationStore,
      useFactory: (client: DynamoDBDocumentClient, config: ConfigService) =>
        new DynamoConversationStore(client, config),
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    { provide: CONVERSATION_STORE, useExisting: DynamoConversationStore },
    MockChannel,
    WhatsAppChannel,
    TelegramChannel,
    {
      provide: MESSAGING_CHANNELS,
      useFactory: (mock: MockChannel, wa: WhatsAppChannel, tg: TelegramChannel) => [mock, wa, tg],
      inject: [MockChannel, WhatsAppChannel, TelegramChannel],
    },
    ChatOrchestrator,
  ],
  exports: [
    INTENT_PARSER,
    CONVERSATION_STORE,
    MESSAGING_CHANNELS,
    IntentParserService,
    DynamoConversationStore,
    ChatOrchestrator,
    WhatsAppChannel,
    TelegramChannel,
  ],
})
export class ChatModule {}
