import { Injectable } from '@nestjs/common';
import type { ICategorySuggester, CategorySuggestion } from '../interfaces/ICategorySuggester';
import { EXPENSE_CATEGORIES } from '@/domains/receipts/ReceiptService';

type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const KEYWORD_MAP: Array<{ pattern: RegExp; category: ExpenseCategory }> = [
  { pattern: /fuel|petrol|gas|uber|taxi|transport|bus|okada/i, category: 'Transport' },
  { pattern: /rent|lease|landlord/i, category: 'Rent' },
  { pattern: /salary|wage|payroll|staff|employee/i, category: 'Salaries' },
  { pattern: /electric|water|power|utility|internet|phone|broadband/i, category: 'Utilities' },
  { pattern: /advert|marketing|promo|social media|facebook|google ads/i, category: 'Marketing' },
  { pattern: /supplies|stationery|paper|ink|office supplies/i, category: 'Supplies' },
];

@Injectable()
export class KeywordCategorySuggester implements ICategorySuggester {
  async suggestCategory(description: string, type: 'sale' | 'expense'): Promise<CategorySuggestion> {
    if (type === 'sale') {
      return { category: 'Sales', confidence: 0.9 };
    }

    const text = description.trim();

    for (const { pattern, category } of KEYWORD_MAP) {
      if (pattern.test(text)) {
        return { category, confidence: 0.7 };
      }
    }

    return { category: 'Other', confidence: 0.3 };
  }
}
