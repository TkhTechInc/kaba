import { Global, Module, forwardRef } from '@nestjs/common';
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
  AI_INTENT_PARSER_PROVIDER,
  AI_VOICE_PROVIDER,
  AI_LOAN_PROVIDER,
  AI_LEDGER_QA_PROVIDER,
  AI_VISION_PROVIDER,
  AI_EMBEDDING_PROVIDER,
} from './ai.tokens';

export {
  AI_PROVIDER,
  AI_LLM_PROVIDER,
  AI_RECEIPT_EXTRACTOR,
  AI_SPEECH_TO_TEXT,
  AI_INTENT_PARSER_PROVIDER,
  AI_VOICE_PROVIDER,
  AI_LOAN_PROVIDER,
  AI_LEDGER_QA_PROVIDER,
  AI_VISION_PROVIDER,
  AI_EMBEDDING_PROVIDER,
} from './ai.tokens';

/**
 * Build an OpenRouter provider for a specific model.
 * Falls back to the default provider if the key is missing.
 */
function openRouterFor(apiKey: string, model: string): ILLMProvider {
  return new OpenRouterProvider(apiKey, model);
}

/**
 * Resolve the base LLM provider from AI_PROVIDER env.
 * This is the fallback used when no task-specific env var is set.
 */
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

/**
 * Build a task-specific OpenRouter provider if OPENROUTER_API_KEY is set
 * and a task model override env var exists. Falls back to the base provider.
 *
 * @param taskModelEnv - env var name for the task model override (e.g. AI_INTENT_MODEL)
 * @param defaultModel - OpenRouter model ID to use when the env var is absent
 * @param baseLlm      - already-resolved base provider (used as fallback)
 */
function createTaskProvider(
  taskModelEnv: string,
  defaultModel: string,
  baseLlm: ILLMProvider,
): ILLMProvider {
  const key = process.env['OPENROUTER_API_KEY'] || '';
  if (!key) return baseLlm; // can't use OpenRouter — fall back to base

  const model = process.env[taskModelEnv] || defaultModel;
  return openRouterFor(key, model);
}

@Global()
@Module({
  controllers: [AIController],
  imports: [
    forwardRef(() => LedgerModule),
    ReportModule,
    BusinessModule,
    UsageModule,
    AccessModule,
  ],
  providers: [
    AIQueryService,
    VoiceToTransactionService,
    LoanReadinessService,

    // ── Base provider (default fallback) ────────────────────────────────────
    {
      provide: AI_LLM_PROVIDER,
      useFactory: (config: ConfigService): ILLMProvider => createLLMProvider(config),
      inject: [ConfigService],
    },
    { provide: AI_PROVIDER, useExisting: AI_LLM_PROVIDER },

    // ── Intent parsing: Mistral Small 3.2 24B — fast, cheap, chat-optimised ─
    {
      provide: AI_INTENT_PARSER_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_INTENT_MODEL', 'mistralai/mistral-small-3.2-24b-instruct', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Voice extraction: Qwen3.5-Flash — multilingual, 1M ctx, West Africa ─
    {
      provide: AI_VOICE_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_VOICE_MODEL', 'qwen/qwen3.5-flash', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Loan readiness: DeepSeek R1 — reasoning model for scoring ───────────
    {
      provide: AI_LOAN_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_LOAN_MODEL', 'deepseek/deepseek-r1-0528', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Ledger Q&A: Llama 3.3 70B — best reasoning/price for financial Q&A ─
    {
      provide: AI_LEDGER_QA_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_LEDGER_QA_MODEL', 'meta-llama/llama-3.3-70b-instruct', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Vision / receipt extraction: Qwen3 VL 235B — multimodal ────────────
    {
      provide: AI_VISION_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_VISION_MODEL', 'qwen/qwen3-vl-235b-a22b-instruct', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Embeddings: Qwen3 Embedding 8B — $0.01/1M input, $0 output ──────────
    {
      provide: AI_EMBEDDING_PROVIDER,
      useFactory: (_config: ConfigService, base: ILLMProvider): ILLMProvider =>
        createTaskProvider('AI_EMBEDDING_MODEL', 'qwen/qwen3-embedding-8b', base),
      inject: [ConfigService, AI_LLM_PROVIDER],
    },

    // ── Receipt extractor: uses AI_VISION_PROVIDER ───────────────────────────
    {
      provide: AI_RECEIPT_EXTRACTOR,
      useFactory: (config: ConfigService, visionLlm: ILLMProvider): IReceiptExtractor => {
        const provider = config.get<string>('ai.provider') || process.env['AI_PROVIDER'] || '';
        if (!provider.trim()) return new MockReceiptExtractor();
        return new LLMReceiptExtractor(visionLlm);
      },
      inject: [ConfigService, AI_VISION_PROVIDER],
    },

    // ── Speech-to-text: always mock (Whisper / AWS Transcribe when ready) ───
    {
      provide: AI_SPEECH_TO_TEXT,
      useFactory: (_config: ConfigService): ISpeechToText => {
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
    AI_INTENT_PARSER_PROVIDER,
    AI_VOICE_PROVIDER,
    AI_LOAN_PROVIDER,
    AI_LEDGER_QA_PROVIDER,
    AI_VISION_PROVIDER,
    AI_EMBEDDING_PROVIDER,
    VoiceToTransactionService,
  ],
})
export class AIModule {}
