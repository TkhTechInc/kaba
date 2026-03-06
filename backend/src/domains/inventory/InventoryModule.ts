import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { AuditModule } from '@/domains/audit/AuditModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { ProductRepository } from './repositories/ProductRepository';
import { ProductService } from './services/ProductService';
import { ProductController } from './ProductController';
import { RestockLoanService } from './services/RestockLoanService';
import { RestockLoanController } from './RestockLoanController';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';

@Module({
  imports: [AuditModule, BusinessModule, forwardRef(() => LedgerModule)],
  controllers: [ProductController, RestockLoanController],
  providers: [
    {
      provide: ProductRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName =
          config.get<string>('dynamodb.inventoryTable') ?? 'QuickBooks-Inventory-dev';
        return new ProductRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
    {
      provide: RestockLoanService,
      useFactory: (
        productRepository: ProductRepository,
        ledgerRepository: LedgerRepository,
        docClient: DynamoDBDocumentClient,
        config: ConfigService
      ) => {
        const tableName =
          config.get<string>('dynamodb.inventoryTable') ?? 'QuickBooks-Inventory-dev';
        return new RestockLoanService(productRepository, ledgerRepository, docClient, tableName);
      },
      inject: [ProductRepository, LedgerRepository, DYNAMODB_DOC_CLIENT, ConfigService],
    },
    ProductService,
  ],
  exports: [ProductService, ProductRepository, RestockLoanService],
})
export class InventoryModule {}
