import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReceiptController } from './ReceiptController';
import { ReceiptService } from './ReceiptService';
import { ReceiptStorageService } from './ReceiptStorageService';
import { MockReceiptPdfGenerator } from './providers/MockReceiptPdfGenerator';
import { PdfKitReceiptGenerator } from './providers/PdfKitReceiptGenerator';
import { AccessModule } from '@/domains/access/AccessModule';
import { BusinessModule } from '@/domains/business/BusinessModule';
import { NotificationsModule } from '@/domains/notifications/NotificationsModule';
import { RECEIPT_PDF_PROVIDER } from './receipt.tokens';
import type { IReceiptPdfGenerator } from './interfaces/IReceiptPdfGenerator';

@Module({
  imports: [AccessModule, BusinessModule, NotificationsModule],
  controllers: [ReceiptController],
  providers: [
    ReceiptService,
    ReceiptStorageService,
    {
      provide: RECEIPT_PDF_PROVIDER,
      useFactory: (config: ConfigService): IReceiptPdfGenerator => {
        const provider =
          config?.get<string>('receiptPdf.provider') || process.env['RECEIPT_PDF_PROVIDER'] || 'mock';
        if (provider === 'pdfkit') {
          return new PdfKitReceiptGenerator();
        }
        return new MockReceiptPdfGenerator();
      },
      inject: [ConfigService],
    },
  ],
  exports: [ReceiptService, ReceiptStorageService, RECEIPT_PDF_PROVIDER],
})
export class ReceiptModule {}
