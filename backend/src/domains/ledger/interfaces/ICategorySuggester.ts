export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-1
}

export interface ICategorySuggester {
  suggestCategory(description: string, type: 'sale' | 'expense'): Promise<CategorySuggestion>;
}
