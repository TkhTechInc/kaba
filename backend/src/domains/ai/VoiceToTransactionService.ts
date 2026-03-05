import { Inject, Injectable } from '@nestjs/common';
import { AI_LLM_PROVIDER, AI_SPEECH_TO_TEXT } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from './ILLMProvider';
import type { ISpeechToText } from './ISpeechToText';
import { LedgerService } from '@/domains/ledger/services/LedgerService';

export interface VoiceTransactionResult {
  success: boolean;
  entry?: {
    id: string;
    type: string;
    amount: number;
    description: string;
    category: string;
  };
  error?: string;
}

@Injectable()
export class VoiceToTransactionService {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
    @Inject(AI_SPEECH_TO_TEXT) private readonly speechToText: ISpeechToText,
    private readonly ledgerService: LedgerService,
  ) {}

  async processFromAudio(
    audioBuffer: Buffer,
    businessId: string,
    currency: string = 'NGN',
  ): Promise<VoiceTransactionResult> {
    let transcription: Awaited<ReturnType<typeof this.speechToText.transcribe>>;
    try {
      transcription = await this.speechToText.transcribe(audioBuffer);
    } catch (sttErr) {
      return { success: false, error: `Speech-to-text failed: ${(sttErr as Error).message ?? 'Unknown error'}` };
    }
    return this.processFromText(transcription.text, businessId, currency);
  }

  async processFromText(
    text: string,
    businessId: string,
    currency: string = 'NGN',
  ): Promise<VoiceTransactionResult> {
    let extracted: { type: 'sale' | 'expense'; amount: number; description: string; category: string };
    try {
      const result = await this.llm.generateStructured<{
        type: 'sale' | 'expense';
        amount: number;
        description: string;
        category: string;
      }>({
        prompt: `Extract transaction from: "${text}"`,
        systemPrompt: 'Extract sale or expense. Return JSON: { type: "sale"|"expense", amount: number, description: string, category: string }. For "I sold X for Y" use type sale. For "I spent Y on X" use type expense.',
        jsonSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['sale', 'expense'] },
            amount: { type: 'number' },
            description: { type: 'string' },
            category: { type: 'string' },
          },
          required: ['type', 'amount', 'description', 'category'],
        },
      });
      extracted = result.data;
    } catch (llmErr) {
      return { success: false, error: `AI extraction failed: ${(llmErr as Error).message ?? 'Unknown error'}` };
    }

    const { type, amount, description, category } = extracted;
    if (!type || typeof amount !== 'number' || isNaN(amount)) {
      return { success: false, error: 'AI could not extract a valid transaction from the text' };
    }

    const today = new Date().toISOString().split('T')[0];

    try {
      const entry = await this.ledgerService.createEntry({
        businessId,
        type,
        amount,
        currency,
        description: description || text.slice(0, 100),
        category: category || 'Other',
        date: today,
      });

      return {
        success: true,
        entry: {
          id: entry.id,
          type: entry.type,
          amount: entry.amount,
          description: entry.description,
          category: entry.category,
        },
      };
    } catch (createErr) {
      return { success: false, error: `Failed to save transaction: ${(createErr as Error).message ?? 'Unknown error'}` };
    }
  }
}
