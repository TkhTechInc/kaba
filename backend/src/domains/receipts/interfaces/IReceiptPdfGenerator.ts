/**
 * Interface for generating merchant-branded receipt PDFs.
 * Implementations: PdfKitReceiptGenerator, MockReceiptPdfGenerator.
 * Switch via RECEIPT_PDF_PROVIDER env.
 */
export interface ReceiptPdfInput {
  businessName: string;
  businessLogoUrl?: string;
  vendor?: string;
  date: string;
  total: number;
  currency: string;
  items?: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

export interface IReceiptPdfGenerator {
  /** Generate a receipt PDF buffer. */
  generate(input: ReceiptPdfInput): Promise<Buffer>;
}
