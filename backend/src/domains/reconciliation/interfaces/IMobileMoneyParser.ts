/**
 * Interface for parsing mobile money SMS (MTN MoMo, Moov, etc.) into ledger entries.
 * Implementations: LLMMobileMoneyParser (uses ILLMProvider), RegexMobileMoneyParser.
 * Switch via MOBILE_MONEY_PARSER_PROVIDER env.
 */
export interface ParsedMobileMoneyTransaction {
  amount: number;
  currency: string;
  date: string; // YYYY-MM-DD
  type: 'credit' | 'debit';
  reference?: string;
  description?: string;
}

export interface IMobileMoneyParser {
  /** Parse SMS text into a structured transaction. Throws if parsing fails. */
  parse(smsText: string): Promise<ParsedMobileMoneyTransaction>;
}
