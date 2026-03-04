/**
 * Mock receipt extractor for development.
 * Returns stub extraction result without calling vision APIs.
 */

import type { IReceiptExtractor, ReceiptExtractionResult } from './IReceiptExtractor';

export class MockReceiptExtractor implements IReceiptExtractor {
  async extract(_imageUrlOrBuffer: string | Buffer): Promise<ReceiptExtractionResult> {
    return {
      vendor: 'Mock Vendor Ltd',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      currency: 'NGN',
      lineItems: [],
      rawText: '[Mock] Receipt extraction placeholder',
    };
  }
}
