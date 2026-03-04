import { Inject, Injectable } from '@nestjs/common';
import type { IReceiptExtractor } from '@/domains/ai/IReceiptExtractor';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type { ReceiptExtractionResult } from '@/domains/ai/IReceiptExtractor';
import { AI_RECEIPT_EXTRACTOR, AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';

export const EXPENSE_CATEGORIES = [
  'Supplies',
  'Transport',
  'Utilities',
  'Salaries',
  'Marketing',
  'Rent',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ProcessReceiptResult {
  extracted: ReceiptExtractionResult;
  suggestedCategory: ExpenseCategory;
}

@Injectable()
export class ReceiptService {
  constructor(
    @Inject(AI_RECEIPT_EXTRACTOR) private readonly receiptExtractor: IReceiptExtractor,
    @Inject(AI_LLM_PROVIDER) private readonly llmProvider: ILLMProvider,
  ) {}

  async processReceipt(imageBuffer: Buffer, businessId: string): Promise<ProcessReceiptResult> {
    const extracted = await this.receiptExtractor.extract(imageBuffer);
    const suggestedCategory = await this.suggestCategory(extracted);
    return { extracted, suggestedCategory };
  }

  private async suggestCategory(extracted: ReceiptExtractionResult): Promise<ExpenseCategory> {
    const prompt = `Given this receipt: vendor="${extracted.vendor ?? 'unknown'}", total=${extracted.total ?? 0}, currency=${extracted.currency ?? 'NGN'}, rawText="${(extracted.rawText ?? '').slice(0, 200)}". Map to exactly one expense category.`;
    const result = await this.llmProvider.generateStructured<{ category: ExpenseCategory }>({
      prompt,
      systemPrompt: `You are an expense categorizer. Return JSON with a single "category" field. Valid categories: ${EXPENSE_CATEGORIES.join(', ')}. Default to "Other" if unclear.`,
      jsonSchema: {
        type: 'object',
        properties: { category: { type: 'string', enum: [...EXPENSE_CATEGORIES] } },
        required: ['category'],
      },
    });
    const cat = result.data.category;
    return EXPENSE_CATEGORIES.includes(cat) ? cat : 'Other';
  }
}
