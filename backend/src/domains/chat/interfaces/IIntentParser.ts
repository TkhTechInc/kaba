export type IntentType =
  | 'record_sale'
  | 'record_expense'
  | 'check_balance'
  | 'list_unpaid_invoices'
  | 'list_debts'
  | 'get_trust_score'
  | 'generate_invoice'
  | 'send_invoice'
  | 'get_report'
  | 'unknown';

export interface ParsedIntent {
  type: IntentType;
  entities: Record<string, unknown>;   // amount, currency, customer, description, etc.
  confidence: number;                  // 0–1
  rawText: string;
}

export interface IIntentParser {
  parse(text: string, sessionContext?: string[]): Promise<ParsedIntent>;
}
