import type { IMobileMoneyParser, ParsedMobileMoneyTransaction } from '../interfaces/IMobileMoneyParser';

/**
 * Mock parser that returns a placeholder. Use LLMMobileMoneyParser for production.
 */
export class MockMobileMoneyParser implements IMobileMoneyParser {
  async parse(_smsText: string): Promise<ParsedMobileMoneyTransaction> {
    throw new Error(
      'Mobile money parsing is not configured. Set MOBILE_MONEY_PARSER_PROVIDER=llm and configure AI_PROVIDER.',
    );
  }
}
