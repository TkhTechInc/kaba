import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditRepository } from './repositories/AuditRepository';
import { AuditService } from './services/AuditService';
import { AuditAnomalyService } from './services/AuditAnomalyService';
import { BusinessAuditController } from './controllers/BusinessAuditController';

export const AUDIT_LOGGER = 'IAuditLogger';

@Module({
  controllers: [BusinessAuditController],
  providers: [
    {
      provide: AuditRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.auditLogsTable') ?? 'QuickBooks-AuditLogs-dev';
        const retentionDays =
          config.get<number>('compliance.auditRetentionDays') ?? 2555;
        return new AuditRepository(docClient, tableName, retentionDays);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    AuditService,
    AuditAnomalyService,
    {
      provide: AUDIT_LOGGER,
      useExisting: AuditService,
    },
  ],
  exports: [AUDIT_LOGGER, AuditService, AuditAnomalyService],
})
export class AuditModule {}
