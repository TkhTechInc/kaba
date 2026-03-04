import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { TaxEngineManager } from '@/domains/tax/TaxEngineManager';
import { TaxController } from '@/domains/tax/TaxController';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { TAX_ENGINE } from './tax.tokens';

export { TAX_ENGINE } from './tax.tokens';

@Global()
@Module({
  imports: [AccessModule, BusinessModule],
  controllers: [TaxController],
  providers: [
    {
      provide: TAX_ENGINE,
      useClass: TaxEngineManager,
    },
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'QuickBooks-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [TAX_ENGINE],
})
export class TaxModule {}
