import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InvoiceService } from './services/InvoiceService';
import { InvoiceShareService } from './services/InvoiceShareService';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { GetInvoiceQueryDto } from './dto/get-invoice-query.dto';
import { GeneratePaymentLinkDto } from './dto/payment-link.dto';
import { RefundInvoiceDto } from './dto/refund-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { Auth, Public } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { AuditIpAddress, AuditUserAgent } from '@/nest/common/decorators/audit-context.decorator';
import { IsString, IsOptional } from 'class-validator';

class ApproveInvoiceDto {
  @IsString()
  businessId!: string;
}

class ListByStatusQueryDto {
  @IsString()
  businessId!: string;

  @IsString()
  @IsOptional()
  status?: string;
}

@Controller('api/v1/invoices')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('invoicing')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoiceShareService: InvoiceShareService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateInvoiceDto,
    @AuditUserId() userId?: string,
    @AuditIpAddress() ipAddress?: string,
    @AuditUserAgent() userAgent?: string,
  ) {
    const invoice = await this.invoiceService.create(
      {
        businessId: dto.businessId,
        customerId: dto.customerId,
        amount: dto.amount,
        currency: dto.currency,
        items: dto.items,
        dueDate: dto.dueDate,
        status: dto.status,
        earlyPaymentDiscountPercent: dto.earlyPaymentDiscountPercent,
        earlyPaymentDiscountDays: dto.earlyPaymentDiscountDays,
      },
      userId,
      { ipAddress, userAgent },
    );
    return { success: true, data: invoice };
  }

  @Get('pay/:token')
  @Public()
  async getPayByToken(@Param('token') token: string) {
    const raw = await this.invoiceShareService.getInvoiceByToken(token);
    if (!raw) throw new NotFoundException('Invoice not found or link expired');
    // Flatten for frontend: businessName, invoiceId, items, etc.
    return {
      success: true,
      data: {
        ...raw.invoice,
        businessName: raw.business.name,
        customerName: raw.customer.name,
        invoiceNumber: raw.invoice.id.slice(0, 8),
        paymentUrl: raw.paymentUrl,
        intentId: raw.intentId,
        useKkiaPayWidget: raw.useKkiaPayWidget,
        useMomoRequest: raw.useMomoRequest,
      },
    };
  }

  @Post('pay/request-momo')
  @Public()
  async requestMoMoPayment(@Body() body: { token: string; phone: string }) {
    const { token, phone } = body;
    if (!token?.trim() || !phone?.trim()) {
      throw new NotFoundException('token and phone are required');
    }
    const result = await this.invoiceShareService.requestMoMoPayment(token.trim(), phone.trim());
    if (!result.success) {
      throw new NotFoundException(result.error ?? 'MoMo payment request failed');
    }
    return { success: true, message: 'Payment request sent to your phone. Please approve on your MoMo app.' };
  }

  @Post('pay/confirm-kkiapay')
  @Public()
  async confirmKkiaPay(@Body() body: { token: string; transactionId: string; intentId: string; redirectStatus?: string }) {
    const { token, transactionId, intentId, redirectStatus } = body;
    if (!token?.trim() || !transactionId?.trim() || !intentId?.trim()) {
      throw new NotFoundException('token, transactionId and intentId are required');
    }
    const result = await this.invoiceShareService.confirmKkiaPayPayment(
      token.trim(),
      transactionId.trim(),
      intentId.trim(),
      redirectStatus?.trim(),
    );
    if (!result.success) {
      throw new NotFoundException(result.error ?? 'Payment confirmation failed');
    }
    return { success: true };
  }

  @Get()
  @RequirePermission('invoices:read')
  async list(
    @Query() query: ListInvoicesQueryDto & { status?: string; fromDate?: string; toDate?: string },
    @Query('cursor') cursor?: string,
  ) {
    if (cursor !== undefined) {
      const result = await this.invoiceService.listWithCursor(
        query.businessId,
        Number(query.limit) || 20,
        cursor || undefined,
        query.fromDate,
        query.toDate,
      );
      return { success: true, data: result };
    }
    if (query.status) {
      const result = await this.invoiceService.listByStatus(
        query.businessId,
        query.status as import('./models/Invoice').InvoiceStatus,
        Number(query.limit) || 20
      );
      return { success: true, data: { items: result.items } };
    }
    const result = await this.invoiceService.list(
      query.businessId,
      Number(query.page) || 1,
      Number(query.limit) || 20,
      undefined,
      query.fromDate,
      query.toDate,
    );
    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get('pending-approval')
  @RequirePermission('invoices:read')
  async listPendingApproval(@Query('businessId') businessId: string) {
    const result = await this.invoiceService.listPendingApproval(businessId);
    return { success: true, data: { items: result.items } };
  }

  @Post(':id/approve')
  @RequirePermission('invoices:write')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveInvoiceDto,
    @AuditUserId() userId?: string,
    @AuditIpAddress() ipAddress?: string,
    @AuditUserAgent() userAgent?: string,
  ) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }
    const invoice = await this.invoiceService.approveInvoice(dto.businessId, id, userId, { ipAddress, userAgent });
    return { success: true, data: invoice };
  }

  @Get(':id/whatsapp-link')
  @RequirePermission('invoices:read')
  async getWhatsAppLink(
    @Param('id') id: string,
    @Query() query: GetInvoiceQueryDto,
  ) {
    const { url } = await this.invoiceShareService.generateWhatsAppShareLink(query.businessId, id);
    return { success: true, data: { url } };
  }

  @Get(':id')
  @RequirePermission('invoices:read')
  async getById(@Param('id') id: string, @Query() query: GetInvoiceQueryDto) {
    const invoice = await this.invoiceService.getById(query.businessId, id);
    return { success: true, data: invoice };
  }

  @Patch(':id')
  @RequirePermission('invoices:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto & { businessId?: string },
    @Query('businessId') businessId: string,
    @AuditUserId() userId?: string,
    @AuditIpAddress() ipAddress?: string,
    @AuditUserAgent() userAgent?: string,
  ) {
    const bid = dto.businessId ?? businessId;
    if (!bid) {
      return { success: false, error: 'businessId is required' };
    }
    const invoice = await this.invoiceService.update(bid, id, {
      customerId: dto.customerId,
      amount: dto.amount,
      currency: dto.currency,
      items: dto.items,
      dueDate: dto.dueDate,
      earlyPaymentDiscountPercent: dto.earlyPaymentDiscountPercent,
      earlyPaymentDiscountDays: dto.earlyPaymentDiscountDays,
    }, userId, { ipAddress, userAgent });
    return { success: true, data: invoice };
  }

  @Post(':id/refund')
  @Feature('payment_links')
  @RequirePermission('invoices:write')
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundInvoiceDto,
    @AuditUserId() userId?: string,
  ) {
    const result = await this.invoiceService.refund(
      dto.businessId,
      id,
      { amount: dto.amount, reason: dto.reason },
      userId,
    );
    if (!result.success) {
      throw new NotFoundException(result.error ?? 'Refund failed');
    }
    return { success: true };
  }

  @Post(':id/payment-link')
  @Feature('payment_links')
  @RequirePermission('invoices:write')
  async generatePaymentLink(
    @Param('id') id: string,
    @Body() dto: GeneratePaymentLinkDto,
  ) {
    // Same URL as POS: share token → /pay/{token}. Customer opens it and pays on the pay page.
    const { payUrl } = await this.invoiceShareService.generatePublicToken(id, dto.businessId);
    return { success: true, data: { paymentUrl: payUrl } };
  }

  @Post(':id/share')
  @RequirePermission('invoices:write')
  async generateShareToken(
    @Param('id') id: string,
    @Body() dto: GeneratePaymentLinkDto
  ) {
    const { token, payUrl } = await this.invoiceShareService.generatePublicToken(
      id,
      dto.businessId
    );
    return { success: true, data: { token, payUrl } };
  }

  @Post(':id/send')
  @RequirePermission('invoices:write')
  async send(@Param('id') id: string, @Body() dto: SendInvoiceDto) {
    const result = await this.invoiceService.sendInvoice(dto.businessId, id);
    return { success: true, data: { sent: result.sent, channel: result.channel } };
  }

  @Post(':id/send-whatsapp')
  @Feature('whatsapp_invoice_delivery')
  @RequirePermission('invoices:write')
  async sendWhatsApp(@Param('id') id: string, @Body() dto: SendInvoiceDto) {
    const result = await this.invoiceService.sendInvoiceViaWhatsApp(dto.businessId, id);
    return { success: result.success, messageId: result.messageId };
  }

  /**
   * Download invoice/receipt/thermal PDF.
   * GET /api/v1/invoices/:id/pdf?businessId=...&mode=invoice|receipt|thermal
   */
  @Get(':id/pdf')
  @RequirePermission('invoices:read')
  async downloadPdf(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @Query('mode') mode: string = 'invoice',
    @Res() res: Response,
  ) {
    const validMode = ['invoice', 'receipt', 'thermal'].includes(mode) ? mode : 'invoice';
    const buffer = await this.invoiceService.generatePdf(
      businessId,
      id,
      validMode as import('./services/InvoicePdfService').PdfMode,
    );
    const filename = `${validMode}-${id.slice(0, 12)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /**
   * Mark invoice as paid via cash (POS in-store).
   * POST /api/v1/invoices/:id/mark-paid
   */
  @Post(':id/mark-paid')
  @RequirePermission('invoices:write')
  async markPaidCash(
    @Param('id') id: string,
    @Body() dto: { businessId: string },
    @AuditUserId() userId?: string,
  ) {
    const invoice = await this.invoiceService.markPaidCash(dto.businessId, id, userId);
    return { success: true, data: invoice };
  }
}
