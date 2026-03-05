import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type { IReceiptExtractor } from '@/domains/ai/IReceiptExtractor';
import type { ISpeechToText } from '@/domains/ai/ISpeechToText';
import { MockLLMProvider } from '@/domains/ai/MockLLMProvider';
import { MockReceiptExtractor } from '@/domains/ai/MockReceiptExtractor';
import { MockSpeechToText } from '@/domains/ai/MockSpeechToText';
import { LLMReceiptExtractor } from '@/domains/ai/LLMReceiptExtractor';
import { ClaudeProvider } from '@/domains/ai/providers/ClaudeProvider';
import { OpenAIProvider } from '@/domains/ai/providers/OpenAIProvider';
import { BedrockProvider } from '@/domains/ai/providers/BedrockProvider';
import { GeminiProvider } from '@/domains/ai/providers/GeminiProvider';
import { OpenRouterProvider } from '@/domains/ai/providers/OpenRouterProvider';
import { AIQueryService } from '@/domains/ai/AIQueryService';
import { VoiceToTransactionService } from '@/domains/ai/VoiceToTransactionService';
import { LoanReadinessService } from '@/domains/ai/LoanReadinessService';
import { AIController } from '@/domains/ai/AIController';
import { LedgerModule } from '@/domains/ledger/LedgerModule';
import { ReportModule } from '@/domains/reports/ReportModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { UsageModule } from '@/domains/usage/UsageModule';
import { AccessModule } from '@/domains/access/AccessModule';
import {
  AI_PROVIDER,
  AI_LLM_PROVIDER,
  AI_RECEIPT_EXTRACTOR,
  AI_SPEECH_TO_TEXT,
} from './ai.tokens';

export {
  AI_PROVIDER,
  AI_LLM_PROVIDER,
  AI_RECEIPT_EXTRACTOR,
  AI_SPEECH_TO_TEXT,
} from './ai.tokens';

function createLLMProvider(config: ConfigService): ILLMProvider {
  const provider = config.get<string>('ai.provider') || process.env['AI_PROVIDER'] || '';
  const model = process.env['AI_MODEL'] || config.get<string>('ai.model') || '';
  const region = process.env['AI_BEDROCK_REGION'] || config.get<string>('ai.bedrockRegion') || 'us-east-1';

  switch (provider.toLowerCase().trim()) {
    case 'claude': {
      const key = process.env['ANTHROPIC_API_KEY'] || '';
      if (!key) throw new Error('ANTHROPIC_API_KEY is required for Claude provider');
      return new ClaudeProvider(key, model || 'claude-3-5-sonnet-20241022');
    }
    case 'openai': {
      const key = process.env['OPENAI_API_KEY'] || '';
      if (!key) throw new Error('OPENAI_API_KEY is required for OpenAI provider');
      return new OpenAIProvider(key, model || 'gpt-4o-mini');
    }
    case 'bedrock': {
      const modelId = model || 'meta.llama3-3-70b-instruct-v1:0';
      return new BedrockProvider({ region, modelId });
    }
    case 'gemini': {
      const key = process.env['GEMINI_API_KEY'] || '';
      if (!key) throw new Error('GEMINI_API_KEY is required for Gemini provider');
      return new GeminiProvider(key, model || 'gemini-1.5-flash');
    }
    case 'openrouter': {
      const key = process.env['OPENROUTER_API_KEY'] || '';
      if (!key) throw new Error('OPENROUTER_API_KEY is required for OpenRouter provider');
      const openRouterModel = (model?.includes('/') ? model : null) ?? 'openai/gpt-4o-mini';
      return new OpenRouterProvider(key, openRouterModel);
    }
    default:
      return new MockLLMProvider();
  }
}

@Global()
@Module({
  controllers: [AIController],
  imports: [LedgerModule, ReportModule, BusinessModule, UsageModule, AccessModule],
  providers: [
    AIQueryService,
    VoiceToTransactionService,
    LoanReadinessService,
    {
      provide: AI_LLM_PROVIDER,
      useFactory: (config: ConfigService): ILLMProvider => createLLMProvider(config),
      inject: [ConfigService],
    },
    { provide: AI_PROVIDER, useExisting: AI_LLM_PROVIDER },
    {
      provide: AI_RECEIPT_EXTRACTOR,
      useFactory: (config: ConfigService, llm: ILLMProvider): IReceiptExtractor => {
        const provider = config.get<string>('ai.provider') || process.env['AI_PROVIDER'] || '';
        if (!provider.trim()) return new MockReceiptExtractor();
        return new LLMReceiptExtractor(llm);
      },
      inject: [ConfigService, AI_LLM_PROVIDER],
    },
    {
      provide: AI_SPEECH_TO_TEXT,
      useFactory: (_config: ConfigService): ISpeechToText => {
        // Real STT providers (Whisper, AWS Transcribe) can be wired here when needed.
        // For now, the mock returns a placeholder — voice-to-transaction uses LLM text path.
        return new MockSpeechToText();
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AI_PROVIDER,
    AI_LLM_PROVIDER,
    AI_RECEIPT_EXTRACTOR,
    AI_SPEECH_TO_TEXT,
  ],
})
export class AIModule {}
