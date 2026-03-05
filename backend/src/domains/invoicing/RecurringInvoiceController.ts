import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RecurringInvoiceService } from './services/RecurringInvoiceService';
import {
  CreateRecurringScheduleDto,
  CancelRecurringScheduleDto,
} from './dto/create-recurring-schedule.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';

@Controller('api/v1/invoices')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('invoicing')
export class RecurringInvoiceController {
  constructor(
    private readonly recurringInvoiceService: RecurringInvoiceService
  ) {}

  @Post('recurring')
  @RequirePermission('invoices:write')
  async createSchedule(
    @Body() dto: CreateRecurringScheduleDto,
    @AuditUserId() userId?: string
  ) {
    const schedule = await this.recurringInvoiceService.createSchedule(
      dto.businessId,
      dto.templateInvoiceId,
      dto.interval,
      userId
    );
    return { success: true, data: schedule };
  }

  @Get('recurring')
  @RequirePermission('invoices:read')
  async listSchedules(@Query('businessId') businessId: string) {
    if (!businessId) {
      return { success: false, error: 'businessId is required' };
    }
    const schedules =
      await this.recurringInvoiceService.listByBusiness(businessId);
    return { success: true, data: { items: schedules } };
  }

  @Delete('recurring/:id')
  @RequirePermission('invoices:write')
  async cancelSchedule(
    @Param('id') id: string,
    @Body() dto: CancelRecurringScheduleDto,
    @Query('businessId') businessIdQuery?: string
  ) {
    const businessId = dto?.businessId ?? businessIdQuery;
    if (!businessId) {
      return { success: false, error: 'businessId is required (body or query)' };
    }
    await this.recurringInvoiceService.cancelSchedule(businessId, id);
    return { success: true, data: { cancelled: true } };
  }
}
