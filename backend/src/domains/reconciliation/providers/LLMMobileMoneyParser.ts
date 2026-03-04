import { Inject } from '@nestjs/common';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.module';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type {
  IMobileMoneyParser,
  ParsedMobileMoneyTransaction,
} from '../interfaces/IMobileMoneyParser';

/**
 * Parses MTN MoMo, Moov, and similar mobile money SMS using LLM.
 * Supports formats like:
 * - "You have received 50,000 XAF from John. Ref: ABC123. 04/03/2025"
 * - "Debit of 5,000 NGN. Balance: 10,000. 03-Mar-2025"
 */
export class LLMMobileMoneyParser implements IMobileMoneyParser {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  async parse(smsText: string): Promise<ParsedMobileMoneyTransaction> {
    if (!smsText?.trim()) {
      throw new Error('SMS text is required');
    }

    const result = await this.llm.generateStructured<{
      amount: number;
      currency: string;
      date: string;
      type: 'credit' | 'debit';
      reference?: string;
      description?: string;
    }>({
      prompt: `Parse this mobile money SMS into structured data. Extract amount, currency (NGN, XOF, XAF, GHS, USD, EUR), date (YYYY-MM-DD), type (credit=received, debit=sent), and optional reference/description.\n\nSMS:\n${smsText.trim()}`,
      systemPrompt: `You are a parser for West African mobile money SMS (MTN MoMo, Moov, Orange Money, etc.). 
Return valid JSON with: amount (number), currency (3-letter code), date (YYYY-MM-DD), type ("credit" or "debit"), reference (optional), description (optional).
For date: if only time, use today's date. If "04/03/2025" or "03-Mar-2025", convert to YYYY-MM-DD.
Default currency to NGN if not found.`,
      jsonSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
          date: { type: 'string' },
          type: { type: 'string', enum: ['credit', 'debit'] },
          reference: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['amount', 'currency', 'date', 'type'],
      },
    });

    const d = result.data;
    if (!d.amount || !d.currency || !d.date || !d.type) {
      throw new Error('Failed to parse SMS: missing required fields');
    }

    return {
      amount: Number(d.amount),
      currency: String(d.currency).toUpperCase().slice(0, 3),
      date: this.normalizeDate(d.date),
      type: d.type as 'credit' | 'debit',
      reference: d.reference ? String(d.reference) : undefined,
      description: d.description ? String(d.description) : d.reference ? `Ref: ${d.reference}` : undefined,
    };
  }

  private normalizeDate(dateStr: string): string {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return dateStr;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }
}
