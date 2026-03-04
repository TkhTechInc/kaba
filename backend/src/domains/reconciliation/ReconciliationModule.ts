import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.module';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { MockMobileMoneyParser } from './providers/MockMobileMoneyParser';
import { LLMMobileMoneyParser } from './providers/LLMMobileMoneyParser';
import { ReconciliationService } from './services/ReconciliationService';
import { ReconciliationController } from './ReconciliationController';
import { MOBILE_MONEY_PARSER } from './reconciliation.tokens';
import type { IMobileMoneyParser } from './interfaces/IMobileMoneyParser';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { UsageModule } from '@/domains/usage/UsageModule';
import { AIModule } from '@/nest/modules/ai/ai.module';

@Module({
  imports: [AIModule, LedgerModule, BusinessModule, UsageModule],
  controllers: [ReconciliationController],
  providers: [
    {
      provide: MOBILE_MONEY_PARSER,
      useFactory: (config: ConfigService, llm: ILLMProvider): IMobileMoneyParser => {
        const provider =
          config?.get<string>('mobileMoney.parserProvider') ||
          process.env['MOBILE_MONEY_PARSER_PROVIDER'] ||
          'mock';
        if (provider === 'llm') {
          return new LLMMobileMoneyParser(llm);
        }
        return new MockMobileMoneyParser();
      },
      inject: [ConfigService, AI_LLM_PROVIDER],
    },
    ReconciliationService,
  ],
  exports: [MOBILE_MONEY_PARSER, ReconciliationService],
})
export class ReconciliationModule {}
