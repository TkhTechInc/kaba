import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { InvoiceService } from './services/InvoiceService';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesQueryDto } from './dto/list-invoices-query.dto';
import { GetInvoiceQueryDto } from './dto/get-invoice-query.dto';
import { GeneratePaymentLinkDto } from './dto/payment-link.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
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
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  async create(@Body() dto: CreateInvoiceDto, @AuditUserId() userId?: string) {
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
      userId
    );
    return { success: true, data: invoice };
  }

  @Get()
  @RequirePermission('invoices:read')
  async list(@Query() query: ListInvoicesQueryDto & { status?: string }) {
    if (query.status) {
      const result = await this.invoiceService.listByStatus(
        query.businessId,
        query.status as import('./models/Invoice').InvoiceStatus,
        query.limit ?? 20
      );
      return { success: true, data: { items: result.items } };
    }
    const result = await this.invoiceService.list(
      query.businessId,
      query.page ?? 1,
      query.limit ?? 20
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
  ) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }
    const invoice = await this.invoiceService.approveInvoice(dto.businessId, id, userId);
    return { success: true, data: invoice };
  }

  @Get(':id')
  @RequirePermission('invoices:read')
  async getById(@Param('id') id: string, @Query() query: GetInvoiceQueryDto) {
    const invoice = await this.invoiceService.getById(query.businessId, id);
    return { success: true, data: invoice };
  }

  @Post(':id/payment-link')
  @Feature('payment_links')
  @RequirePermission('invoices:write')
  async generatePaymentLink(
    @Param('id') id: string,
    @Body() dto: GeneratePaymentLinkDto
  ) {
    const { paymentUrl } = await this.invoiceService.generatePaymentLink(dto.businessId, id);
    return { success: true, data: { paymentUrl } };
  }
}
