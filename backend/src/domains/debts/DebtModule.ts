import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '@/domains/audit/AuditModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { DebtRepository } from './repositories/DebtRepository';
import { DebtService } from './services/DebtService';
import { DebtController } from './DebtController';

@Module({
  imports: [AuditModule, BusinessModule, NotificationsModule],
  controllers: [DebtController],
  providers: [
    {
      provide: DebtRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new DebtRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    DebtService,
  ],
  exports: [DebtService, DebtRepository],
})
export class DebtModule {}
