import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '@/nest/modules/dynamodb/dynamodb.module';
import { TaxEngineManager } from '@/domains/tax/TaxEngineManager';
import { TaxController } from '@/domains/tax/TaxController';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import { StubFNEProvider } from '@/domains/tax/providers/StubFNEProvider';
import { StubMECeFProvider } from '@/domains/tax/providers/StubMECeFProvider';
import { BeninEmecefAdapter } from '@/domains/tax/providers/BeninEmecefAdapter';
import { CoteDIvoireFneAdapter } from '@/domains/tax/providers/CoteDIvoireFneAdapter';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { TAX_ENGINE, FNE_PROVIDER, MECEF_PROVIDER } from './tax.tokens';

export { TAX_ENGINE, FNE_PROVIDER, MECEF_PROVIDER } from './tax.tokens';

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
      provide: FNE_PROVIDER,
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('fiscal.fneCiApiKey');
        return apiKey ? new CoteDIvoireFneAdapter(config) : new StubFNEProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: MECEF_PROVIDER,
      useFactory: (config: ConfigService) => {
        const jwt = config.get<string>('fiscal.mecefBeninJwt');
        return jwt ? new BeninEmecefAdapter(config) : new StubMECeFProvider();
      },
      inject: [ConfigService],
    },
    {
      provide: LedgerRepository,
      useFactory: (docClient: DynamoDBDocumentClient, config: ConfigService) => {
        const tableName = config.get<string>('dynamodb.ledgerTable') ?? 'Kaba-Ledger-dev';
        return new LedgerRepository(docClient, tableName);
      },
      inject: [DYNAMODB_DOC_CLIENT, ConfigService],
    },
  ],
  exports: [TAX_ENGINE, FNE_PROVIDER, MECEF_PROVIDER],
})
export class TaxModule {}
