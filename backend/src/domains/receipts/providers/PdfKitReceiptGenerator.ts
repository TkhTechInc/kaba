import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { IReceiptPdfGenerator, ReceiptPdfInput } from '../interfaces/IReceiptPdfGenerator';

/**
 * PdfKit-based receipt PDF generator. Produces merchant-branded receipt PDFs.
 * Switch via RECEIPT_PDF_PROVIDER=pdfkit.
 */
@Injectable()
export class PdfKitReceiptGenerator implements IReceiptPdfGenerator {
  async generate(input: ReceiptPdfInput): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header: business name
      doc.fontSize(20).text(input.businessName, { align: 'center' });
      doc.moveDown(0.5);

      // Optional logo (skip if absent)
      // businessLogoUrl not implemented - Business model has no logo field yet

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
}
