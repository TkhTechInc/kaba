import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { VoiceOtpService } from './VoiceOtpService';
import { VoiceCallbackController } from './VoiceCallbackController';
import { OtpModule } from '@/domains/otp/OtpModule';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';

@Module({
  imports: [OtpModule],
  controllers: [VoiceCallbackController],
  providers: [
    VoiceOtpService,
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
