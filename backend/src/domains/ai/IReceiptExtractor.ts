/**
 * Receipt extraction interface — no SDK imports.
 * Implementations (e.g. vision LLM, OCR) live in separate files.
 */

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptExtractionResult {
  vendor?: string;
  date?: string;
  total?: number;
  currency?: string;
  lineItems: ReceiptLineItem[];
  rawText?: string;
}

export interface IReceiptExtractor {
  /**
   * Extract structured data from a receipt image.
   * @param imageUrlOrBuffer - URL or Buffer of the receipt image
   */
  extract(imageUrlOrBuffer: string | Buffer): Promise<ReceiptExtractionResult>;
}
