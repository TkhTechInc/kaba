import { Controller, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { DebtService } from './services/DebtService';
import { CreateDebtDto } from './dto/create-debt.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/debts')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('debt_tracker')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  @Post()
  @RequirePermission('ledger:write')
  async create(@Body() dto: CreateDebtDto) {
    const debt = await this.debtService.create({
      businessId: dto.businessId,
      debtorName: dto.debtorName,
      amount: dto.amount,
      currency: dto.currency,
      dueDate: dto.dueDate,
      customerId: dto.customerId,
      phone: dto.phone,
      notes: dto.notes,
    });
    return { success: true, data: debt };
  }

  @Get()
  @RequirePermission('ledger:read')
  async list(
    @Query('businessId') businessId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: 'pending' | 'paid' | 'overdue',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const result = await this.debtService.list(
      businessId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      fromDate,
      toDate,
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

  @Post(':id/mark-paid')
  @RequirePermission('ledger:write')
  async markPaid(@Query('businessId') businessId: string, @Param('id') id: string) {
    const debt = await this.debtService.markPaid(businessId, id);
    if (!debt) {
      return { success: false, message: 'Debt not found' };
    }
    return { success: true, data: debt };
  }

  @Post(':id/remind')
  @RequirePermission('ledger:write')
  async sendReminder(@Query('businessId') businessId: string, @Param('id') id: string) {
    const result = await this.debtService.sendReminder(businessId, id);
    return { success: true, data: result };
  }
}
