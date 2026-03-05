import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Invoice } from '../models/Invoice';
import type { Customer } from '../models/Customer';

@Injectable()
export class InvoicePdfService {
  /**
   * Generate invoice PDF buffer.
   * Uses pdfkit (same pattern as PdfExportService).
   */
  async generateInvoicePdf(
    invoice: Invoice,
    customer: Customer,
    businessName?: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Invoice', { align: 'center' });
      doc.moveDown();

      if (businessName) {
        doc.fontSize(12).text(businessName, { align: 'center' });
        doc.moveDown();
      }

      doc.fontSize(10);
      doc.text(`Invoice #: ${invoice.id}`);
      doc.text(`Date: ${invoice.createdAt.slice(0, 10)}`);
      doc.text(`Due Date: ${invoice.dueDate}`);
      doc.moveDown();

      doc.fontSize(12).text('Bill To', { underline: true });
      doc.fontSize(10);
      doc.text(customer.name);
      doc.text(customer.email);
      if (customer.phone) {
        doc.text(customer.phone);
      }
      doc.moveDown(2);

      doc.fontSize(12).text('Items', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const colWidths = { desc: 200, qty: 60, unit: 80, amount: 100 };
      const startX = 50;

      doc.fontSize(10);
      doc.text('Description', startX, tableTop);
      doc.text('Qty', startX + colWidths.desc, tableTop);
      doc.text('Unit Price', startX + colWidths.desc + colWidths.qty, tableTop);
      doc.text('Amount', startX + colWidths.desc + colWidths.qty + colWidths.unit, tableTop);
      doc.moveDown(0.5);

      let y = doc.y;
      for (const item of invoice.items) {
        doc.text(item.description, startX, y);
        doc.text(String(item.quantity), startX + colWidths.desc, y);
        doc.text(
          `${invoice.currency} ${item.unitPrice.toLocaleString()}`,
          startX + colWidths.desc + colWidths.qty,
          y,
        );
        doc.text(
          `${invoice.currency} ${item.amount.toLocaleString()}`,
          startX + colWidths.desc + colWidths.qty + colWidths.unit,
          y,
        );
        y += 20;
      }
      doc.y = y + 10;

      doc.fontSize(11).text(
        `Total: ${invoice.currency} ${invoice.amount.toLocaleString()}`,
        { align: 'right' },
      );
      doc.moveDown();

      if (
        invoice.earlyPaymentDiscountPercent != null &&
        invoice.earlyPaymentDiscountPercent > 0 &&
        invoice.earlyPaymentDiscountDays != null &&
        invoice.earlyPaymentDiscountDays > 0
      ) {
        const discountAmount =
          Math.round(
            invoice.amount * (invoice.earlyPaymentDiscountPercent / 100) * 100,
          ) / 100;
        doc.fontSize(10).text(
          `Early payment discount: ${invoice.earlyPaymentDiscountPercent}% off if paid within ${invoice.earlyPaymentDiscountDays} days (save ${invoice.currency} ${discountAmount.toLocaleString()})`,
          { align: 'left' },
        );
      }

      doc.end();
    });
  }
}
