import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { PaymentModule } from '@/domains/payments/PaymentModule';
import { StorefrontController } from './StorefrontController';
import { StorefrontPaymentRepository } from './StorefrontPaymentRepository';
import { StorefrontPaymentService } from './StorefrontPaymentService';

@Module({
  imports: [
    BusinessModule,
    LedgerModule,
    forwardRef(() => PaymentModule),
  ],
  controllers: [StorefrontController],
  providers: [
    {
      provide: StorefrontPaymentRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-LedgerService-dev-ledger';
        return new StorefrontPaymentRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    StorefrontPaymentService,
  ],
  exports: [StorefrontPaymentService],
})
export class StorefrontModule {}
