import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.module';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { MockMobileMoneyParser } from './providers/MockMobileMoneyParser';
import { LLMMobileMoneyParser } from './providers/LLMMobileMoneyParser';
import { ReconciliationService } from './services/ReconciliationService';
import { BankStatementImportService } from './services/BankStatementImportService';
import { ReconciliationController } from './ReconciliationController';
import { MOBILE_MONEY_PARSER } from './reconciliation.tokens';
import type { IMobileMoneyParser } from './interfaces/IMobileMoneyParser';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { UsageModule } from '@/domains/usage/UsageModule';
import { AuditModule } from '@/domains/audit/AuditModule';
import { InvoiceModule } from '@/domains/invoicing/InvoiceModule';
import { AIModule } from '@/nest/modules/ai/ai.module';

@Module({
  imports: [AIModule, LedgerModule, BusinessModule, UsageModule, AuditModule, InvoiceModule],
  controllers: [ReconciliationController],
  providers: [
    {
      provide: MOBILE_MONEY_PARSER,
      useFactory: (config: ConfigService, llm: ILLMProvider): IMobileMoneyParser => {
        const provider =
          config?.get<string>('mobileMoney.parserProvider') ||
          process.env['MOBILE_MONEY_PARSER_PROVIDER'] ||
          'mock';
        const parser = provider === 'llm' ? new LLMMobileMoneyParser(llm) : new MockMobileMoneyParser();
        if (process.env['NODE_ENV'] !== 'production') {
          console.log(`[Reconciliation] Mobile money parser: ${provider}`);
        }
        return parser;
      },
      inject: [ConfigService, AI_LLM_PROVIDER],
    },
    ReconciliationService,
    BankStatementImportService,
  ],
  exports: [MOBILE_MONEY_PARSER, ReconciliationService, BankStatementImportService],
})
export class ReconciliationModule {}
