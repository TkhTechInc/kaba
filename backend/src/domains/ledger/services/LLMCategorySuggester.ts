import { Inject, Injectable } from '@nestjs/common';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type { ICategorySuggester, CategorySuggestion } from '../interfaces/ICategorySuggester';
import { EXPENSE_CATEGORIES } from '@/domains/receipts/ReceiptService';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';

@Injectable()
export class LLMCategorySuggester implements ICategorySuggester {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  async suggestCategory(description: string, type: 'sale' | 'expense'): Promise<CategorySuggestion> {
    if (type === 'sale') {
      return { category: 'Sales', confidence: 0.9 };
    }

    const prompt = `Given expense description '${description}', suggest one category from: ${EXPENSE_CATEGORIES.join(', ')}. Return { category, confidence } where confidence is 0-1.`;
    const result = await this.llm.generateStructured<{ category: string; confidence: number }>({
      prompt,
      systemPrompt: `You are an expense categorizer. Return JSON with "category" and "confidence" (0-1). Valid categories: ${EXPENSE_CATEGORIES.join(', ')}. Default to "Other" if unclear.`,
      jsonSchema: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...EXPENSE_CATEGORIES] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['category', 'confidence'],
      },
    });

    const cat = result.data.category;
    const confidence = Math.max(0, Math.min(1, result.data.confidence ?? 0.5));
    const validCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(cat)
      ? cat
      : 'Other';

    return { category: validCategory, confidence };
  }
}
