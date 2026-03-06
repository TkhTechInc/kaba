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
} from '@nestjs/common';
import { CustomerService } from './services/CustomerService';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';
import { GetCustomerQueryDto } from './dto/get-customer-query.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
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
  constructor(private readonly customerService: CustomerService) {}

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
  async list(@Query() query: ListCustomersQueryDto & { fromDate?: string; toDate?: string }) {
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
}
