import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { ApiKeyRepository } from './repositories/ApiKeyRepository';
import { ApiKeyService } from './ApiKeyService';
import { ApiKeyController } from './ApiKeyController';
import { AuditModule } from '../audit/AuditModule';
import { AccessModule } from '../access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';

@Module({
  imports: [AuditModule, AccessModule, BusinessModule],
  controllers: [ApiKeyController],
  providers: [
    {
      provide: ApiKeyRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new ApiKeyRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ApiKeyService,
  ],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
