import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { PLReport } from './ReportService';
import type { CashFlowSummary } from './ReportService';

@Injectable()
export class PdfExportService {
  /** Generate P&L report as PDF buffer. */
  async generatePLPdf(report: PLReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Profit & Loss Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Period: ${report.period.start} to ${report.period.end}`);
      doc.moveDown(2);

      doc.fontSize(12).text('Summary', { underline: true });
      doc.fontSize(10);
      doc.text(`Total Income: ${report.currency} ${report.totalIncome.toLocaleString()}`);
      doc.text(`Total Expenses: ${report.currency} ${report.totalExpenses.toLocaleString()}`);
      doc.text(`Net Profit: ${report.currency} ${report.netProfit.toLocaleString()}`);
      doc.moveDown(2);

      if (report.byCategory.length > 0) {
        doc.fontSize(12).text('By Category', { underline: true });
        doc.fontSize(10);
        report.byCategory.forEach(({ category, amount, type }) => {
          doc.text(`${category} (${type}): ${report.currency} ${amount.toLocaleString()}`);
        });
      }

      doc.end();
    });
  }

  /** Generate cash flow report as PDF buffer. */
  async generateCashFlowPdf(report: CashFlowSummary): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Cash Flow Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Period: ${report.period.start} to ${report.period.end}`);
      doc.moveDown(2);

      doc.fontSize(12).text('Summary', { underline: true });
      doc.fontSize(10);
      doc.text(`Opening Balance: ${report.currency} ${report.openingBalance.toLocaleString()}`);
      doc.text(`Total Inflows: ${report.currency} ${report.totalInflows.toLocaleString()}`);
      doc.text(`Total Outflows: ${report.currency} ${report.totalOutflows.toLocaleString()}`);
      doc.text(`Closing Balance: ${report.currency} ${report.closingBalance.toLocaleString()}`);
      doc.end();
    });
  }
}
