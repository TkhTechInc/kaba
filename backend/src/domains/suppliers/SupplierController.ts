import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { SupplierService } from './services/SupplierService';
import { SupplierPaymentService } from './services/SupplierPaymentService';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { PaySupplierDto } from './dto/pay-supplier.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/suppliers')
@Auth()
@UseGuards(PermissionGuard)
export class SupplierController {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly supplierPaymentService: SupplierPaymentService,
  ) {}

  @Post()
  @RequirePermission('ledger:write')
  async create(@Query('businessId') businessId: string, @Body() dto: CreateSupplierDto) {
    const supplier = await this.supplierService.create(businessId, dto);
    return { success: true, data: supplier };
  }

  @Get()
  @RequirePermission('ledger:read')
  async list(@Query('businessId') businessId: string) {
    const result = await this.supplierService.list(businessId);
    return { success: true, data: result };
  }

  @Get(':id')
  @RequirePermission('ledger:read')
  async getById(@Query('businessId') businessId: string, @Param('id') id: string) {
    const supplier = await this.supplierService.getById(businessId, id);
    return { success: true, data: supplier };
  }

  @Put(':id')
  @RequirePermission('ledger:write')
  async update(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateSupplierDto>,
  ) {
    const supplier = await this.supplierService.update(businessId, id, dto);
    return { success: true, data: supplier };
  }

  @Delete(':id')
  @RequirePermission('ledger:write')
  async delete(@Query('businessId') businessId: string, @Param('id') id: string) {
    await this.supplierService.delete(businessId, id);
    return { success: true };
  }

  @Post(':id/pay')
  @RequirePermission('ledger:write')
  async pay(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: PaySupplierDto,
  ) {
    const result = await this.supplierPaymentService.paySupplier(
      businessId,
      id,
      dto.amount,
      dto.currency,
      dto.description,
    );
    return { success: true, data: result };
  }
}
