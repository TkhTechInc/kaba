import type { IReceiptPdfGenerator, ReceiptPdfInput } from '../interfaces/IReceiptPdfGenerator';

/**
 * Mock PDF generator. Returns minimal PDF buffer for development.
 * Use PdfKitReceiptGenerator for production.
 */
export class MockReceiptPdfGenerator implements IReceiptPdfGenerator {
  async generate(input: ReceiptPdfInput): Promise<Buffer> {
    const text = `Receipt\n${input.businessName}\n${input.vendor ?? 'N/A'}\n${input.date}\n${input.currency} ${input.total}`;
    return Buffer.from(text, 'utf-8');
  }
}
