/**
 * Receipt extractor backed by a vision-capable LLM (Claude, GPT-4o, Gemini).
 * Falls back to text prompt if provider does not support vision.
 */

import type { ILLMProvider, GenerateStructuredWithImageRequest } from './ILLMProvider';
import type { IReceiptExtractor, ReceiptExtractionResult, ReceiptLineItem } from './IReceiptExtractor';

export class LLMReceiptExtractor implements IReceiptExtractor {
  constructor(private readonly llm: ILLMProvider) {}

  async extract(imageUrlOrBuffer: string | Buffer): Promise<ReceiptExtractionResult> {
    const schema = {
      type: 'object',
      properties: {
        vendor: { type: 'string' },
        date: { type: 'string', description: 'ISO date YYYY-MM-DD' },
        total: { type: 'number' },
        currency: { type: 'string', description: '3-letter ISO 4217 code e.g. NGN, GHS, XOF' },
        lineItems: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              total: { type: 'number' },
            },
            required: ['description', 'quantity', 'unitPrice', 'total'],
          },
        },
        rawText: { type: 'string' },
      },
      required: ['vendor', 'date', 'total', 'currency', 'lineItems'],
    };

    const prompt = 'Extract all structured data from this receipt image. Return vendor name, date, total amount, currency, and line items.';
    const systemPrompt = 'You are a receipt OCR system for West African MSMEs. Extract data accurately. Use ISO 4217 currency codes (NGN for Nigerian Naira, GHS for Ghana Cedis, XOF for West African CFA franc).';

    let rawResult: unknown;

    if (typeof imageUrlOrBuffer === 'string') {
      if (this.llm.generateStructuredWithImage) {
        const req: GenerateStructuredWithImageRequest<ReceiptExtractionResult> = {
          prompt,
          systemPrompt,
          jsonSchema: schema,
          imageUrl: imageUrlOrBuffer,
        };
        const res = await this.llm.generateStructuredWithImage(req);
        rawResult = res.data;
      } else {
        const res = await this.llm.generateStructured<ReceiptExtractionResult>({
          prompt: `${prompt}\n\nImage URL: ${imageUrlOrBuffer}`,
          systemPrompt,
          jsonSchema: schema,
        });
        rawResult = res.data;
      }
    } else {
      const imageBase64 = imageUrlOrBuffer.toString('base64');
      if (this.llm.generateStructuredWithImage) {
        const req: GenerateStructuredWithImageRequest<ReceiptExtractionResult> = {
          prompt,
          systemPrompt,
          jsonSchema: schema,
          imageBase64,
        };
        const res = await this.llm.generateStructuredWithImage(req);
        rawResult = res.data;
      } else {
        throw new Error(
          'Receipt image extraction from raw image buffer requires a vision-capable LLM provider (Claude, GPT-4o, or Gemini). ' +
          'Set AI_PROVIDER=claude, openai, or gemini and provide the corresponding API key, ' +
          'or pass a publicly accessible image URL instead of a buffer.',
        );
      }
    }

    const r = rawResult as Partial<ReceiptExtractionResult>;
    return {
      vendor: r.vendor ?? 'Unknown',
      date: r.date ?? new Date().toISOString().split('T')[0],
      total: typeof r.total === 'number' ? r.total : 0,
      currency: r.currency ?? 'NGN',
      lineItems: Array.isArray(r.lineItems) ? (r.lineItems as ReceiptLineItem[]) : [],
      rawText: r.rawText,
    };
  }
}
