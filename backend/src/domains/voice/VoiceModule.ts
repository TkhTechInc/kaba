import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { VoiceOtpService } from './VoiceOtpService';
import { VoiceCommandService } from './VoiceCommandService';
import { VoiceCallbackController } from './VoiceCallbackController';
import { OtpModule } from '@/domains/otp/OtpModule';
import { DebtModule } from '@/domains/debts/DebtModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { AccessModule } from '@/domains/access/AccessModule';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';

@Module({
  imports: [OtpModule, DebtModule, LedgerModule, ReportModule, NotificationsModule, AccessModule],
  controllers: [VoiceCallbackController],
  providers: [
    VoiceOtpService,
    VoiceCommandService,
    {
      provide: UserRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new UserRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [VoiceOtpService],
})
export class VoiceModule {}
