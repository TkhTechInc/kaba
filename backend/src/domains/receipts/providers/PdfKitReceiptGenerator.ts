import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { IReceiptPdfGenerator, ReceiptPdfInput } from '../interfaces/IReceiptPdfGenerator';

const LOGO_MAX_HEIGHT = 48;
const LOGO_MAX_WIDTH = 120;

/**
 * PdfKit-based receipt PDF generator. Produces merchant-branded receipt PDFs.
 * Switch via RECEIPT_PDF_PROVIDER=pdfkit.
 */
@Injectable()
export class PdfKitReceiptGenerator implements IReceiptPdfGenerator {
  async generate(input: ReceiptPdfInput): Promise<Buffer> {
    const logoBuffer = await this.fetchLogoBuffer(input.businessLogoUrl);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Optional logo (before business name; skip if load failed)
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, { fit: [LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT], align: 'center' });
          doc.moveDown(0.5);
        } catch {
          // Skip logo if PdfKit cannot decode the image
        }
      }

      // Header: business name
      doc.fontSize(20).text(input.businessName, { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(10).text('Receipt', { align: 'center' });
      doc.moveDown(2);

      // Receipt details
      doc.fontSize(12).text('Details', { underline: true });
      doc.fontSize(10);
      if (input.vendor) {
        doc.text(`Vendor: ${input.vendor}`);
      }
      doc.text(`Date: ${input.date}`);
      doc.text(`Total: ${input.currency} ${input.total.toLocaleString()}`);
      doc.moveDown(2);

      // Line items table (optional)
      if (input.items && input.items.length > 0) {
        doc.fontSize(12).text('Items', { underline: true });
        doc.moveDown(0.5);
        const tableTop = doc.y;
        const colWidths = { desc: 200, qty: 50, unit: 80, total: 80 };
        doc.fontSize(9);
        doc.text('Description', 50, tableTop, { width: colWidths.desc });
        doc.text('Qty', 250, tableTop, { width: colWidths.qty });
        doc.text('Unit', 300, tableTop, { width: colWidths.unit });
        doc.text('Total', 380, tableTop, { width: colWidths.total });
        doc.moveDown(0.3);
        doc
          .moveTo(50, doc.y)
          .lineTo(460, doc.y)
          .stroke();
        doc.moveDown(0.3);

        input.items.forEach((item) => {
          const y = doc.y;
          doc.text(item.description.slice(0, 40), 50, y, { width: colWidths.desc });
          doc.text(String(item.quantity), 250, y, { width: colWidths.qty });
          doc.text(`${input.currency} ${item.unitPrice.toLocaleString()}`, 300, y, {
            width: colWidths.unit,
          });
          doc.text(`${input.currency} ${item.total.toLocaleString()}`, 380, y, {
            width: colWidths.total,
          });
          doc.moveDown(0.2);
        });
      }

      doc.end();
    });
  }

  /** Fetch logo from URL; returns null on any failure (skip logo gracefully). */
  private async fetchLogoBuffer(url?: string): Promise<Buffer | null> {
    if (!url?.trim()) return null;
    try {
      const res = await fetch(url.trim(), { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}
