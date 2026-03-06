import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '@/domains/audit/AuditModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { PaymentModule } from '@/domains/payments/PaymentModule';
import { PlanPaymentRepository } from './PlanPaymentRepository';
import { PlanPaymentService } from './PlanPaymentService';
import { PlanPaymentController } from './PlanPaymentController';

@Module({
  imports: [AuditModule, BusinessModule, PaymentModule],
  controllers: [PlanPaymentController],
  providers: [
    {
      provide: PlanPaymentRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-LedgerService-dev-ledger';
        return new PlanPaymentRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    PlanPaymentService,
  ],
  exports: [PlanPaymentService],
})
export class PlanModule {}
