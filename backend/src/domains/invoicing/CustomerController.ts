import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CustomerService } from './services/CustomerService';
import { CustomerRepository } from './repositories/CustomerRepository';
import { InvoiceRepository } from './repositories/InvoiceRepository';
import { InvoiceShareService } from './services/InvoiceShareService';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { GetCustomerQueryDto } from './dto/get-customer-query.dto';
import { Auth, Public } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/customers')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('invoicing')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly customerRepository: CustomerRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly invoiceShareService: InvoiceShareService,
  ) {}

  @Post()
  @RequirePermission('invoices:write')
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.customerService.create({
      businessId: dto.businessId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    });
    return { success: true, data: customer };
  }

  @Get()
  @RequirePermission('invoices:read')
  async list(
    @Query() query: ListCustomersQueryDto & { fromDate?: string; toDate?: string },
    @Query('cursor') cursor?: string,
  ) {
    if (cursor !== undefined) {
      const result = await this.customerRepository.listWithCursor(
        query.businessId,
        query.limit ?? 20,
        cursor || undefined,
        query.fromDate,
        query.toDate,
      );
      return { success: true, data: result };
    }
    const result = await this.customerService.list(
      query.businessId,
      query.page ?? 1,
      query.limit ?? 20,
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

  @Get(':id')
  @RequirePermission('invoices:read')
  async getById(@Param('id') id: string, @Query() query: GetCustomerQueryDto) {
    const customer = await this.customerService.getById(query.businessId, id);
    return { success: true, data: customer };
  }

  @Patch(':id')
  @RequirePermission('invoices:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @AuditUserId() userId?: string,
  ) {
    const customer = await this.customerService.update(dto.businessId, id, {
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    }, userId);
    return { success: true, data: customer };
  }

  @Delete(':id')
  @RequirePermission('invoices:write')
  async delete(
    @Param('id') id: string,
    @Query() query: GetCustomerQueryDto,
    @AuditUserId() userId?: string,
  ) {
    await this.customerService.delete(query.businessId, id, userId);
    return { success: true };
  }

  /** Public portal: look up a customer by email within a business. */
  @Get('portal/lookup')
  @Public()
  async portalLookup(
    @Query('businessId') businessId: string,
    @Query('email') email: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    if (!email?.trim()) {
      throw new BadRequestException('email is required');
    }
    const customer = await this.customerRepository.findByEmail(businessId, email.trim().toLowerCase());
    if (!customer) {
      throw new NotFoundException('No customer found with that email for this business');
    }
    return {
      success: true,
      data: { customerId: customer.id, name: customer.name },
    };
  }

  /** Public portal: get invoices for a customer (excludes cancelled/draft). Adds payUrl for payable invoices. */
  @Get('portal/invoices')
  @Public()
  async portalInvoices(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    if (!customerId?.trim()) {
      throw new BadRequestException('customerId is required');
    }
    const invoices = await this.invoiceRepository.listByCustomerId(businessId, customerId, 50);
    const visible = invoices.filter((inv) => inv.status !== 'draft' && inv.status !== 'cancelled');

    const items = await Promise.all(
      visible.map(async (inv) => {
        const payable = inv.status === 'sent' || inv.status === 'overdue';
        let payUrl: string | undefined;
        if (payable) {
          try {
            const { payUrl: url } = await this.invoiceShareService.generatePublicToken(inv.id, businessId);
            payUrl = url;
          } catch {
            // omit payUrl if token generation fails
          }
        }
        return { ...inv, ...(payUrl && { payUrl }) };
      }),
    );

    return {
      success: true,
      data: { items },
    };
  }
}
