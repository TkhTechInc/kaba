export { IntentType, ParsedIntent } from '../interfaces/IIntentParser';

export function unknownIntent(rawText: string): import('../interfaces/IIntentParser').ParsedIntent {
  return { type: 'unknown', entities: {}, confidence: 0, rawText };
}
