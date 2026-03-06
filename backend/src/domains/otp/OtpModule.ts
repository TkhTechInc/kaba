import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { OtpRepository } from './OtpRepository';
import { OtpService } from './OtpService';

@Module({
  providers: [
    OtpService,
    {
      provide: OtpRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new OtpRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [OtpService, OtpRepository],
})
export class OtpModule {}
