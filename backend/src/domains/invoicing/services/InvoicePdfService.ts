import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Invoice } from '../models/Invoice';
import type { Customer } from '../models/Customer';
import type { Business } from '@/domains/ledger/models/Business';

// ── Design tokens ──────────────────────────────────────────────────────────────
const PAGE_MARGIN = 48;
const PAGE_WIDTH  = 595.28; // A4
const CONTENT_W   = PAGE_WIDTH - PAGE_MARGIN * 2;

const COLOR_PRIMARY   = '#1E3A5F';
const COLOR_ACCENT    = '#2563EB';
const COLOR_DIVIDER   = '#E5E7EB';
const COLOR_ROW_ALT   = '#F8FAFC';
const COLOR_TEXT      = '#111827';
const COLOR_MUTED     = '#6B7280';
const COLOR_FISCAL_BG = '#EFF6FF';
const COLOR_FISCAL_BD = '#BFDBFE';
const COLOR_PAID_BG   = '#DCFCE7';
const COLOR_PAID_BD   = '#86EFAC';
const COLOR_PAID_TEXT = '#166534';

// Column proportions
const COL_DESC  = 0.44;
const COL_QTY   = 0.10;
const COL_UNIT  = 0.20;
const COL_TOTAL = 0.26;

// Thermal receipt width (72mm at 72dpi ≈ 204pt)
const THERMAL_WIDTH  = 204;
const THERMAL_MARGIN = 8;
const THERMAL_CW     = THERMAL_WIDTH - THERMAL_MARGIN * 2;

export type PdfMode = 'invoice' | 'receipt' | 'thermal';

interface Col {
  x: number;
  w: number;
  label: string;
  align: 'left' | 'right' | 'center';
}

@Injectable()
export class InvoicePdfService {

  async generateInvoicePdf(
    invoice: Invoice,
    customer: Customer,
    businessName?: string,
    business?: Business,
    mode: PdfMode = 'invoice',
  ): Promise<Buffer> {
    const isPaid = invoice.status === 'paid';
    const hasMecef = invoice.mecefStatus === 'confirmed' && !!invoice.mecefSerialNumber;

    let qrImageBuffer: Buffer | null = null;
    if (hasMecef && invoice.mecefQrCode) {
      try {
        qrImageBuffer = await QRCode.toBuffer(invoice.mecefQrCode, {
          type: 'png',
          width: mode === 'thermal' ? 100 : 80,
          margin: 1,
          color: { dark: '#1E3A5F', light: '#ffffff' },
        });
      } catch { /* skip */ }
    }

    if (mode === 'thermal') {
      return this.generateThermal(invoice, customer, businessName, business, qrImageBuffer, isPaid, hasMecef);
    }
    return this.generateA4(invoice, customer, businessName, business, qrImageBuffer, isPaid, hasMecef, mode);
  }

  // ── A4 layout (invoice + receipt modes) ──────────────────────────────────────
  private async generateA4(
    invoice: Invoice,
    customer: Customer,
    businessName: string | undefined,
    business: Business | undefined,
    qrImageBuffer: Buffer | null,
    isPaid: boolean,
    hasMecef: boolean,
    mode: PdfMode,
  ): Promise<Buffer> {
    const isReceipt = mode === 'receipt';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Use plain space as thousands separator (avoids pdfkit narrow-no-break-space rendering issue)
      const fmt = (n: number) =>
        Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const money = (n: number) => `${fmt(n)} ${invoice.currency}`;
      const fmtDate = (iso?: string) => {
        if (!iso) return '—';
        try { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso)); }
        catch { return iso.slice(0, 10); }
      };

      const biz = business;
      const FISCAL_COPY: Record<string, { badge: string; notice: string }> = {
        BJ: {
          badge: 'CERTIFIÉ PAR LA DGI — e-MECeF (Bénin)',
          notice: 'Ce document est certifié électroniquement par la Direction Générale des Impôts du Bénin (e-MECeF).',
        },
        CI: {
          badge: 'CERTIFIÉ PAR LA DGI — FNE (Côte d\'Ivoire)',
          notice: 'Ce document est certifié électroniquement par la Direction Générale des Impôts de Côte d\'Ivoire (FNE).',
        },
      };
      const fiscalCopy = FISCAL_COPY[biz?.countryCode ?? 'BJ'] ?? FISCAL_COPY['BJ'];
      const docLabel = isReceipt ? 'REÇU' : 'INVOICE';

      // ── Header band ──────────────────────────────────────────────────────────
      doc.rect(0, 0, PAGE_WIDTH, 130).fill(COLOR_PRIMARY);

      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
        .text(businessName ?? 'Business', PAGE_MARGIN, 28, { width: CONTENT_W * 0.6 });

      if (biz?.address || biz?.phone) {
        doc.fontSize(8).font('Helvetica').fillColor('#CBD5E1');
        if (biz?.address) doc.text(biz.address, PAGE_MARGIN, doc.y + 2);
        if (biz?.phone)   doc.text(biz.phone);
        if (biz?.taxId)   doc.text(`IFU : ${biz.taxId}`);
      }

      doc.fillColor('#93C5FD').fontSize(28).font('Helvetica-Bold')
        .text(docLabel, PAGE_MARGIN + CONTENT_W * 0.6, 28, { width: CONTENT_W * 0.4, align: 'right' });

      const invoiceNumber = invoice.id.replace(/^inv[_-]?/i, '').slice(0, 12).toUpperCase();
      doc.fillColor('#CBD5E1').fontSize(8).font('Helvetica')
        .text(`# ${invoiceNumber}`, PAGE_MARGIN + CONTENT_W * 0.6, 70, { width: CONTENT_W * 0.4, align: 'right' });

      // ── MECeF QR block — TOP (receipt/invoice when certified) ────────────────
      // Place QR immediately after header for receipts, before items
      if (hasMecef && invoice.mecefSerialNumber) {
        doc.y = 140;
        const fiscalH = qrImageBuffer ? 88 : 60;
        const fiscalY = doc.y;

        doc.rect(PAGE_MARGIN, fiscalY, CONTENT_W, fiscalH).fill(COLOR_FISCAL_BG);
        doc.rect(PAGE_MARGIN, fiscalY, CONTENT_W, fiscalH).strokeColor(COLOR_FISCAL_BD).lineWidth(1).stroke();

        const textW = CONTENT_W - (qrImageBuffer ? 100 : 20);

        doc.fillColor(COLOR_ACCENT).fontSize(7.5).font('Helvetica-Bold')
          .text(fiscalCopy.badge, PAGE_MARGIN + 10, fiscalY + 10, { width: textW });

        doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold')
          .text(invoice.mecefSerialNumber, PAGE_MARGIN + 10, doc.y + 3, {
            width: textW, characterSpacing: 0.8,
          });

        if (invoice.mecefQrCode) {
          doc.fillColor(COLOR_MUTED).fontSize(6.5).font('Helvetica')
            .text(invoice.mecefQrCode, PAGE_MARGIN + 10, doc.y + 3, { width: textW });
        }

        doc.fillColor(COLOR_MUTED).fontSize(6.5).font('Helvetica')
          .text(fiscalCopy.notice, PAGE_MARGIN + 10, doc.y + 3, { width: textW });

        if (qrImageBuffer) {
          try {
            doc.image(qrImageBuffer, PAGE_WIDTH - PAGE_MARGIN - 84, fiscalY + 6, { width: 78, height: 78 });
          } catch { /* skip */ }
        }

        doc.y = fiscalY + fiscalH + 8;
      } else {
        doc.y = 140;
      }

      // ── PAID stamp band ──────────────────────────────────────────────────────
      if (isPaid) {
        const stampY = doc.y;
        doc.rect(PAGE_MARGIN, stampY, CONTENT_W, 28).fill(COLOR_PAID_BG);
        doc.rect(PAGE_MARGIN, stampY, CONTENT_W, 28).strokeColor(COLOR_PAID_BD).lineWidth(1).stroke();
        doc.fillColor(COLOR_PAID_TEXT).fontSize(13).font('Helvetica-Bold')
          .text('✓  PAYÉ', PAGE_MARGIN + 10, stampY + 8, { width: CONTENT_W * 0.5 });
        if (invoice.dueDate) {
          doc.fillColor(COLOR_PAID_TEXT).fontSize(8.5).font('Helvetica')
            .text(`Réglé le ${fmtDate(invoice.dueDate)}`, PAGE_MARGIN + CONTENT_W * 0.5, stampY + 10, {
              width: CONTENT_W * 0.5, align: 'right',
            });
        }
        doc.y = stampY + 36;
      }

      // ── Bill-to / invoice-details row ────────────────────────────────────────
      const metaY = doc.y + 4;
      doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('BILL TO', PAGE_MARGIN, metaY);
      doc.text('DATE',     PAGE_MARGIN + CONTENT_W * 0.55, metaY, { width: CONTENT_W * 0.22 });
      doc.text('ÉCHÉANCE', PAGE_MARGIN + CONTENT_W * 0.78, metaY, { width: CONTENT_W * 0.22 });

      const billY = metaY + 12;
      doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica-Bold')
        .text(customer.name, PAGE_MARGIN, billY, { width: CONTENT_W * 0.5 });
      doc.font('Helvetica').fontSize(9).fillColor(COLOR_MUTED)
        .text(customer.email, PAGE_MARGIN, doc.y + 2, { width: CONTENT_W * 0.5 });
      if (customer.phone) doc.text(customer.phone, { width: CONTENT_W * 0.5 });

      doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica-Bold')
        .text(fmtDate(invoice.createdAt), PAGE_MARGIN + CONTENT_W * 0.55, billY, { width: CONTENT_W * 0.22 });
      doc.text(fmtDate(invoice.dueDate), PAGE_MARGIN + CONTENT_W * 0.78, billY, { width: CONTENT_W * 0.22 });

      doc.y = Math.max(doc.y, billY + 44);

      // ── Divider ──────────────────────────────────────────────────────────────
      const divY = doc.y + 8;
      doc.moveTo(PAGE_MARGIN, divY).lineTo(PAGE_WIDTH - PAGE_MARGIN, divY).strokeColor(COLOR_DIVIDER).lineWidth(1).stroke();
      doc.y = divY + 12;

      // ── Table columns ────────────────────────────────────────────────────────
      const cols: Col[] = [
        { x: PAGE_MARGIN,                                               w: CONTENT_W * COL_DESC,  label: 'DESCRIPTION', align: 'left'   },
        { x: PAGE_MARGIN + CONTENT_W * COL_DESC,                        w: CONTENT_W * COL_QTY,   label: 'QTÉ',         align: 'center' },
        { x: PAGE_MARGIN + CONTENT_W * (COL_DESC + COL_QTY),            w: CONTENT_W * COL_UNIT,  label: 'PRIX UNIT.',  align: 'right'  },
        { x: PAGE_MARGIN + CONTENT_W * (COL_DESC + COL_QTY + COL_UNIT), w: CONTENT_W * COL_TOTAL, label: 'MONTANT',     align: 'right'  },
      ];

      const drawTableHeader = (y: number) => {
        doc.rect(PAGE_MARGIN, y, CONTENT_W, 20).fill(COLOR_PRIMARY);
        cols.forEach((col) => {
          doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
            .text(col.label, col.x + 4, y + 6, { width: col.w - 8, align: col.align });
        });
      };

      drawTableHeader(doc.y);
      doc.y += 22;

      // ── Item rows ────────────────────────────────────────────────────────────
      const ROW_V_PAD = 7;
      const MIN_ROW_H = 24;
      let rowIndex = 0;

      for (const item of invoice.items) {
        doc.fontSize(9);
        const descH = doc.heightOfString(item.description, { width: cols[0].w - 8 });
        const rowH = Math.max(MIN_ROW_H, descH + ROW_V_PAD * 2);

        if (doc.y + rowH > doc.page.height - PAGE_MARGIN - 80) {
          doc.addPage();
          drawTableHeader(PAGE_MARGIN);
          doc.y = PAGE_MARGIN + 22;
        }

        const rowY = doc.y;
        if (rowIndex % 2 === 1) doc.rect(PAGE_MARGIN, rowY, CONTENT_W, rowH).fill(COLOR_ROW_ALT);

        doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica')
          .text(item.description, cols[0].x + 4, rowY + ROW_V_PAD, { width: cols[0].w - 8, lineGap: 1 });

        const midY = rowY + rowH / 2 - 5;
        doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica')
          .text(String(item.quantity), cols[1].x + 4, midY, { width: cols[1].w - 8, align: 'center' });
        doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica')
          .text(money(item.unitPrice), cols[2].x + 4, midY, { width: cols[2].w - 8, align: 'right' });
        doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold')
          .text(money(item.amount), cols[3].x + 4, midY, { width: cols[3].w - 8, align: 'right' });

        doc.moveTo(PAGE_MARGIN, rowY + rowH).lineTo(PAGE_WIDTH - PAGE_MARGIN, rowY + rowH)
          .strokeColor(COLOR_DIVIDER).lineWidth(0.5).stroke();

        doc.y = rowY + rowH;
        rowIndex++;
      }

      // ── Totals ───────────────────────────────────────────────────────────────
      const TOTALS_W = CONTENT_W * 0.38;
      const TOTALS_X = PAGE_MARGIN + CONTENT_W - TOTALS_W;
      doc.y += 12;

      const drawTotalsRow = (label: string, value: string, highlight = false) => {
        const ty = doc.y;
        if (highlight) doc.rect(TOTALS_X, ty, TOTALS_W, 22).fill(COLOR_PRIMARY);
        doc
          .fillColor(highlight ? '#FFFFFF' : COLOR_MUTED)
          .fontSize(highlight ? 10 : 8.5)
          .font(highlight ? 'Helvetica-Bold' : 'Helvetica')
          .text(label, TOTALS_X + 8, ty + (highlight ? 6 : 4), { width: TOTALS_W * 0.5 - 8 });
        doc
          .fillColor(highlight ? '#FFFFFF' : COLOR_TEXT)
          .fontSize(highlight ? 10 : 8.5)
          .font(highlight ? 'Helvetica-Bold' : 'Helvetica')
          .text(value, TOTALS_X + TOTALS_W * 0.5, ty + (highlight ? 6 : 4), {
            width: TOTALS_W * 0.5 - 8, align: 'right',
          });
        doc.y = ty + (highlight ? 22 : 18);
      };

      drawTotalsRow('Sous-total', money(invoice.amount));

      if (invoice.earlyPaymentDiscountPercent && invoice.earlyPaymentDiscountPercent > 0
          && invoice.earlyPaymentDiscountDays && invoice.earlyPaymentDiscountDays > 0) {
        const disc = Math.round(invoice.amount * (invoice.earlyPaymentDiscountPercent / 100));
        drawTotalsRow(`Remise ${invoice.earlyPaymentDiscountPercent}% / ${invoice.earlyPaymentDiscountDays}j`, `- ${money(disc)}`);
      }

      doc.y += 4;
      const totalLabel = isPaid ? 'MONTANT PAYÉ' : 'TOTAL DÛ';
      drawTotalsRow(totalLabel, money(invoice.amount), true);

      // ── Footer ───────────────────────────────────────────────────────────────
      const footerY = doc.page.height - PAGE_MARGIN - 20;
      doc.moveTo(PAGE_MARGIN, footerY).lineTo(PAGE_WIDTH - PAGE_MARGIN, footerY)
        .strokeColor(COLOR_DIVIDER).lineWidth(0.5).stroke();
      doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica')
        .text(`Généré par Kaba · ${businessName ?? ''}`, PAGE_MARGIN, footerY + 6, {
          width: CONTENT_W, align: 'center',
        });

      const totalPages = (doc.bufferedPageRange?.() ?? { count: 1 }).count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor(COLOR_MUTED).fontSize(7)
          .text(`Page ${i + 1} / ${totalPages}`, PAGE_MARGIN, doc.page.height - PAGE_MARGIN - 8, {
            width: CONTENT_W, align: 'right',
          });
      }

      doc.end();
    });
  }

  // ── Thermal receipt (72mm roll) ───────────────────────────────────────────────
  private async generateThermal(
    invoice: Invoice,
    customer: Customer,
    businessName: string | undefined,
    business: Business | undefined,
    qrImageBuffer: Buffer | null,
    isPaid: boolean,
    hasMecef: boolean,
  ): Promise<Buffer> {
    const lineCount = invoice.items.length;
    // Estimate page height: header~120 + qr~110 + items*(20) + totals~60 + footer~40
    const pageHeight = 120 + (hasMecef ? 110 : 0) + lineCount * 22 + 100;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [THERMAL_WIDTH, pageHeight],
        margin: THERMAL_MARGIN,
        bufferPages: false,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fmt = (n: number) =>
        Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const money = (n: number) => `${fmt(n)} ${invoice.currency}`;
      const fmtDate = (iso?: string) => {
        if (!iso) return '—';
        try { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(iso)); }
        catch { return iso.slice(0, 10); }
      };

      let y = THERMAL_MARGIN;

      // ── Business name ────────────────────────────────────────────────────────
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#000000')
        .text(businessName ?? 'Business', THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 2;

      if (business?.address) {
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(business.address, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
        y = doc.y + 1;
      }
      if (business?.phone) {
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(business.phone, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
        y = doc.y + 1;
      }
      if (business?.taxId) {
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(`IFU: ${business.taxId}`, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
        y = doc.y + 1;
      }

      // ── Divider ──────────────────────────────────────────────────────────────
      y = doc.y + 4;
      doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      y += 5;

      // Label: REÇU or FACTURE
      const docLabel = isPaid ? 'REÇU DE PAIEMENT' : 'FACTURE';
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
        .text(docLabel, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 2;

      const invoiceNumber = invoice.id.replace(/^inv[_-]?/i, '').slice(0, 12).toUpperCase();
      doc.fontSize(7).font('Helvetica').fillColor('#555555')
        .text(`# ${invoiceNumber}`, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 1;
      doc.text(`${fmtDate(invoice.createdAt)}`, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 1;
      doc.text(`Client : ${customer.name}`, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 4;

      // ── MECeF QR at the top — BEFORE items ───────────────────────────────────
      if (hasMecef && invoice.mecefQrCode) {
        doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
          .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        y += 5;

        // QR image centered
        if (qrImageBuffer) {
          const qrSize = 96;
          try {
            doc.image(qrImageBuffer, (THERMAL_WIDTH - qrSize) / 2, y, { width: qrSize, height: qrSize });
            y += qrSize + 3;
          } catch { /* skip */ }
        }

        // codeMECeFDGI below QR
        if (invoice.mecefSerialNumber) {
          doc.fontSize(6).font('Helvetica-Bold').fillColor('#1E3A5F')
            .text(invoice.mecefSerialNumber, THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center', characterSpacing: 0.5 });
          y = doc.y + 1;
        }

        doc.fontSize(5.5).font('Helvetica').fillColor('#888888')
          .text('Certifié DGI — e-MECeF Bénin', THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
        y = doc.y + 4;

        doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
          .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        y += 5;
      }

      // ── Column header ────────────────────────────────────────────────────────
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000')
        .text('ARTICLE', THERMAL_MARGIN, y, { width: THERMAL_CW * 0.45 });
      doc.text('QTÉ',    THERMAL_MARGIN + THERMAL_CW * 0.45, y, { width: THERMAL_CW * 0.15, align: 'center' });
      doc.text('MONTANT', THERMAL_MARGIN + THERMAL_CW * 0.60, y, { width: THERMAL_CW * 0.40, align: 'right' });
      y = doc.y + 2;

      doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      y += 3;

      // ── Items ─────────────────────────────────────────────────────────────────
      for (const item of invoice.items) {
        const rowStartY = y;
        doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
          .text(item.description, THERMAL_MARGIN, y, { width: THERMAL_CW * 0.45, lineGap: 0.5 });

        const descEndY = doc.y;
        const rowEndY = Math.max(descEndY, rowStartY + 12);

        const midY = rowStartY + (rowEndY - rowStartY) / 2 - 4;
        doc.fontSize(7.5).font('Helvetica').fillColor('#000000')
          .text(String(item.quantity), THERMAL_MARGIN + THERMAL_CW * 0.45, midY, {
            width: THERMAL_CW * 0.15, align: 'center',
          });
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#000000')
          .text(money(item.amount), THERMAL_MARGIN + THERMAL_CW * 0.60, midY, {
            width: THERMAL_CW * 0.40, align: 'right',
          });

        y = rowEndY + 2;
        doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
          .strokeColor('#EEEEEE').lineWidth(0.3).stroke();
        y += 2;
      }

      // ── Totals ────────────────────────────────────────────────────────────────
      y += 3;
      doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      y += 4;

      if (invoice.earlyPaymentDiscountPercent && invoice.earlyPaymentDiscountPercent > 0
          && invoice.earlyPaymentDiscountDays && invoice.earlyPaymentDiscountDays > 0) {
        const disc = Math.round(invoice.amount * (invoice.earlyPaymentDiscountPercent / 100));
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(`Remise ${invoice.earlyPaymentDiscountPercent}%`, THERMAL_MARGIN, y, { width: THERMAL_CW * 0.6 });
        doc.fontSize(7).font('Helvetica').fillColor('#555555')
          .text(`- ${money(disc)}`, THERMAL_MARGIN + THERMAL_CW * 0.6, y, { width: THERMAL_CW * 0.4, align: 'right' });
        y = doc.y + 2;
      }

      const totalLabel = isPaid ? 'PAYÉ' : 'TOTAL';
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
        .text(totalLabel, THERMAL_MARGIN, y, { width: THERMAL_CW * 0.5 });
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000')
        .text(money(invoice.amount), THERMAL_MARGIN + THERMAL_CW * 0.5, y, { width: THERMAL_CW * 0.5, align: 'right' });
      y = doc.y + 6;

      if (isPaid) {
        doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
          .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
        y += 5;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#166534')
          .text('✓ PAYÉ', THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
        y = doc.y + 4;
      }

      // ── Footer ────────────────────────────────────────────────────────────────
      doc.moveTo(THERMAL_MARGIN, y).lineTo(THERMAL_WIDTH - THERMAL_MARGIN, y)
        .strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      y += 5;
      doc.fontSize(6).font('Helvetica').fillColor('#888888')
        .text('Merci de votre confiance !', THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });
      y = doc.y + 2;
      doc.text('Kaba — kabasika.com', THERMAL_MARGIN, y, { width: THERMAL_CW, align: 'center' });

      doc.end();
    });
  }
}
