import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { DashboardService } from './DashboardService';

@Controller('api/v1/dashboard')
@Auth()
@UseGuards(PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get dashboard summary for a business. Used by frontend overview cards.
   * GET /api/v1/dashboard/summary?businessId=xxx
   */
  @Get('summary')
  @RequirePermission('ledger:read')
  async getSummary(@Query('businessId') businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const summary = await this.dashboardService.getSummary(businessId.trim());
    return { success: true, data: summary };
  }
}
