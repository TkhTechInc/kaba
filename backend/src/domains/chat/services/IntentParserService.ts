import { Inject, Injectable } from '@nestjs/common';
import { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { AI_INTENT_PARSER_PROVIDER } from '@/nest/modules/ai/ai.module';
import { IIntentParser, IntentType, ParsedIntent } from '../interfaces/IIntentParser';

const INTENT_TYPES: IntentType[] = [
  'record_sale',
  'record_expense',
  'check_balance',
  'list_unpaid_invoices',
  'list_debts',
  'get_trust_score',
  'generate_invoice',
  'send_invoice',
  'collect_payment',
  'get_report',
  'unknown',
];

const SYSTEM_PROMPT = `You are a financial assistant for West African small businesses.
Extract the user's intent from their message. Return JSON matching the schema.
Supported intents: ${INTENT_TYPES.join(', ')}.
For record_sale/record_expense, extract: amount (number), currency (string, default XOF), description (string), customerName (string, optional).
For generate_invoice/send_invoice, extract: customerName (string), amount (number), currency (string), invoiceId (string, optional).
For collect_payment/list_debts, extract: customerName (string, optional).
Use "send_invoice" when user says "send invoice", "share payment link", "send payment request to [customer]".
Use "collect_payment" when user says "who owes me", "outstanding payments", "collect payment", "how much is owed".
If unsure, use intent "unknown".`;

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: INTENT_TYPES },
    entities: { type: 'object' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rawText: { type: 'string' },
  },
  required: ['type', 'entities', 'confidence', 'rawText'],
};

@Injectable()
export class IntentParserService implements IIntentParser {
  constructor(@Inject(AI_INTENT_PARSER_PROVIDER) private readonly llm: ILLMProvider) {}

  async parse(text: string, sessionContext: string[] = []): Promise<ParsedIntent> {
    const contextSnippet = sessionContext.slice(-3).join('\n');
    const prompt = contextSnippet
      ? `Recent conversation:\n${contextSnippet}\n\nUser message: ${text}`
      : `User message: ${text}`;

    try {
      const result = await this.llm.generateStructured<ParsedIntent>({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        jsonSchema: INTENT_SCHEMA,
        maxTokens: 256,
        temperature: 0,
      });
      return { ...result.data, rawText: text };
    } catch {
      return { type: 'unknown', entities: {}, confidence: 0, rawText: text };
    }
  }
}
