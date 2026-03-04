import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '../audit/AuditModule';
import { BusinessRepository } from './BusinessRepository';
import { BusinessController } from './BusinessController';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';

@Module({
  imports: [AuditModule],
  controllers: [BusinessController],
  providers: [
    {
      provide: BusinessRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new BusinessRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    PermissionGuard,
  ],
  exports: [BusinessRepository],
})
export class BusinessModule {}
