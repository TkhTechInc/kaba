import { BadRequestException, Body, Controller, Get, Inject, Optional, Post, Query, UseGuards } from '@nestjs/common';
import { ReceiptService } from './ReceiptService';
import { ReceiptStorageService } from './ReceiptStorageService';
import { ProcessReceiptDto } from './dto/process-receipt.dto';
import { SendReceiptPdfDto } from './dto/send-receipt-pdf.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { IReceiptPdfGenerator } from './interfaces/IReceiptPdfGenerator';
import type { IWhatsAppProvider } from '@/domains/notifications/IWhatsAppProvider';
import { RECEIPT_PDF_PROVIDER } from './receipt.tokens';
import { WHATSAPP_PROVIDER } from '@/domains/notifications/notification.tokens';

@Controller('api/v1/receipts')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class ReceiptController {
  constructor(
    private readonly receiptService: ReceiptService,
    private readonly storageService: ReceiptStorageService,
    private readonly businessRepo: BusinessRepository,
    @Inject(RECEIPT_PDF_PROVIDER) private readonly pdfGenerator: IReceiptPdfGenerator,
    @Optional() @Inject(WHATSAPP_PROVIDER) private readonly whatsappProvider?: IWhatsAppProvider,
  ) {}

  /** Get presigned URL for client to upload receipt. */
  @Get('upload-url')
  @Feature('receipts_s3')
  @RequirePermission('receipts:write')
  async getUploadUrl(
    @Query('businessId') businessId: string,
    @Query('contentType') contentType?: string,
  ) {
    const result = await this.storageService.getUploadUrl(
      businessId,
      contentType || 'image/jpeg',
    );
    return { success: true, data: result };
  }

  /** Process receipt from base64 (legacy) or S3 key. */
  @Post('process')
  @Feature('receipts')
  @RequirePermission('receipts:write')
  async processReceipt(@Body() dto: ProcessReceiptDto) {
    let buffer: Buffer;
    if (dto.s3Key && this.storageService.isConfigured()) {
      buffer = await this.storageService.getReceiptBuffer(dto.s3Key);
    } else if (dto.imageBase64) {
      buffer = Buffer.from(dto.imageBase64, 'base64');
    } else {
      throw new Error('Provide imageBase64 or s3Key');
    }
    const result = await this.receiptService.processReceipt(buffer, dto.businessId);
    return { success: true, data: result };
  }

  /** Generate receipt PDF and send via WhatsApp. */
  @Post('send-pdf')
  @Feature('receipt_pdf_whatsapp')
  @RequirePermission('receipts:write')
  async sendReceiptPdf(@Body() dto: SendReceiptPdfDto) {
    if (!dto.phone?.trim()) {
      throw new BadRequestException('phone is required');
    }
    if (!this.storageService.isConfigured()) {
      throw new BadRequestException('S3 storage is not configured for receipt PDFs');
    }
    if (!this.whatsappProvider) {
      throw new BadRequestException('WhatsApp provider is not configured');
    }

    const business = await this.businessRepo.getById(dto.businessId);
    if (!business) {
      throw new BadRequestException('Business not found');
    }

    const pdfInput = {
      businessName: business.name ?? 'Receipt',
      businessLogoUrl: business.logoUrl ?? undefined,
      vendor: dto.vendor,
      date: dto.date ?? new Date().toISOString().slice(0, 10),
      total: dto.total,
      currency: dto.currency ?? business.currency ?? 'NGN',
      items: dto.items,
    };

    const pdfBuffer = await this.pdfGenerator.generate(pdfInput);
    const { url } = await this.storageService.uploadReceiptPdf(dto.businessId, pdfBuffer);

    const caption = `Receipt from ${business.name ?? 'Merchant'}: ${pdfInput.currency} ${pdfInput.total.toLocaleString()}`;

    if (this.whatsappProvider.sendMedia) {
      const result = await this.whatsappProvider.sendMedia(dto.phone.trim(), url, caption);
      return { success: true, messageId: result.messageId };
    }
    const result = await this.whatsappProvider.send(dto.phone.trim(), `${caption}\n${url}`);
    return { success: true, messageId: result.messageId };
  }
}
