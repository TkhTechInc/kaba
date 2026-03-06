import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { EmailVerificationRepository } from './EmailVerificationRepository';
import { EmailService } from './EmailService';
import { PasswordResetRepository } from './PasswordResetRepository';

@Module({
  providers: [
    EmailService,
    {
      provide: EmailVerificationRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-LedgerService-dev-ledger';
        return new EmailVerificationRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: PasswordResetRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-LedgerService-dev-ledger';
        return new PasswordResetRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [EmailVerificationRepository, EmailService, PasswordResetRepository],
})
export class VerificationModule {}
