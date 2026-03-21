import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { PaymentModule } from '@/domains/payments/PaymentModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { SupplierRepository } from './repositories/SupplierRepository';
import { SupplierService } from './services/SupplierService';
import { SupplierPaymentService } from './services/SupplierPaymentService';
import { SupplierController } from './SupplierController';

@Module({
  imports: [LedgerModule, PaymentModule, forwardRef(() => BusinessModule)],
  controllers: [SupplierController],
  providers: [
    {
      provide: SupplierRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new SupplierRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    SupplierService,
    SupplierPaymentService,
  ],
  exports: [SupplierService, SupplierPaymentService],
})
export class SupplierModule {}
