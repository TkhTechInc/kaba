import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBModule, DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AIModule } from '@/nest/modules/ai/ai.module';
import { AccessModule } from '@/domains/access/AccessModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { TrustModule } from '@/domains/trust/TrustModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import { AccessService } from '@/domains/access/AccessService';
import { IntentParserService } from './services/IntentParserService';
import { DynamoConversationStore } from './services/DynamoConversationStore';
import { ChatOrchestrator } from './services/ChatOrchestrator';
import { ChatUserResolver } from './services/ChatUserResolver';
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
    AccessModule,
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
      useFactory: (wa: WhatsAppChannel, tg: TelegramChannel) => [wa, tg],
      inject: [WhatsAppChannel, TelegramChannel],
    },
    // Provision UserRepository the same way UssdModule does — via useFactory with the users table
    {
      provide: UserRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.usersTable') ?? 'Kaba-UsersService-dev-users';
        return new UserRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ChatUserResolver,
    ChatOrchestrator,
  ],
  exports: [
    INTENT_PARSER,
    CONVERSATION_STORE,
    MESSAGING_CHANNELS,
    IntentParserService,
    DynamoConversationStore,
    ChatOrchestrator,
    ChatUserResolver,
    WhatsAppChannel,
    TelegramChannel,
  ],
})
export class ChatModule {}
