import type { IMobileMoneyParser, ParsedMobileMoneyTransaction } from '../interfaces/IMobileMoneyParser';

/**
 * Mock parser used when MOBILE_MONEY_PARSER_PROVIDER=mock.
 * Returns a placeholder transaction so the UI does not break.
 * Real parsing requires MOBILE_MONEY_PARSER_PROVIDER=llm and a configured LLM provider.
 */
export class MockMobileMoneyParser implements IMobileMoneyParser {
  async parse(_smsText: string): Promise<ParsedMobileMoneyTransaction> {
    const today = new Date().toISOString().slice(0, 10);
    return {
      amount: 0,
      currency: 'XXX',
      date: today,
      type: 'credit',
      description: 'Parsing not configured. Set MOBILE_MONEY_PARSER_PROVIDER=llm.',
    };
  }
}
