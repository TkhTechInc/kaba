import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { InvoiceService } from './services/InvoiceService';
import { InvoiceShareService } from './services/InvoiceShareService';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { GetInvoiceQueryDto } from './dto/get-invoice-query.dto';
import { GeneratePaymentLinkDto } from './dto/payment-link.dto';
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
        useKkiaPayWidget: raw.useKkiaPayWidget,
      },
    };
  }

  @Post('pay/confirm-kkiapay')
  @Public()
  async confirmKkiaPay(@Body() body: { token: string; transactionId: string; redirectStatus?: string }) {
    const { token, transactionId, redirectStatus } = body;
    if (!token?.trim() || !transactionId?.trim()) {
      throw new NotFoundException('token and transactionId are required');
    }
    const result = await this.invoiceShareService.confirmKkiaPayPayment(token.trim(), transactionId.trim(), redirectStatus?.trim());
    if (!result.success) {
      throw new NotFoundException(result.error ?? 'Payment confirmation failed');
    }
    return { success: true };
  }

  @Get()
  @RequirePermission('invoices:read')
  async list(@Query() query: ListInvoicesQueryDto & { status?: string; fromDate?: string; toDate?: string }) {
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

  @Post(':id/payment-link')
  @Feature('payment_links')
  @RequirePermission('invoices:write')
  async generatePaymentLink(
    @Param('id') id: string,
    @Body() dto: GeneratePaymentLinkDto,
    @AuditUserId() userId?: string,
  ) {
    const { paymentUrl } = await this.invoiceService.generatePaymentLink(dto.businessId, id, userId);
    return { success: true, data: { paymentUrl } };
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
}
