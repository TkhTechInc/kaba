import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { DashboardService } from './DashboardService';

@SkipThrottle()
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

  /**
   * Get payments overview chart data (received vs due by period).
   * GET /api/v1/dashboard/payments-overview?businessId=xxx&timeFrame=monthly|yearly
   */
  @Get('payments-overview')
  @RequirePermission('ledger:read')
  async getPaymentsOverview(
    @Query('businessId') businessId: string,
    @Query('timeFrame') timeFrame?: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const tf = timeFrame === 'yearly' ? 'yearly' : 'monthly';
    const data = await this.dashboardService.getPaymentsOverview(businessId.trim(), tf);
    return { success: true, data };
  }

  /**
   * Get weekly profit chart data (sales vs expenses by day).
   * GET /api/v1/dashboard/weeks-profit?businessId=xxx&timeFrame=this week|last week
   */
  @Get('weeks-profit')
  @RequirePermission('ledger:read')
  async getWeeksProfit(
    @Query('businessId') businessId: string,
    @Query('timeFrame') timeFrame?: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const tf = timeFrame === 'last week' ? 'last week' : 'this week';
    const data = await this.dashboardService.getWeeksProfit(businessId.trim(), tf);
    return { success: true, data };
  }

  /**
   * Get activity by type (sales vs expenses) for donut chart.
   * GET /api/v1/dashboard/activity-by-type?businessId=xxx&timeFrame=monthly|yearly
   */
  @Get('activity-by-type')
  @RequirePermission('ledger:read')
  async getActivityByType(
    @Query('businessId') businessId: string,
    @Query('timeFrame') timeFrame?: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const tf = timeFrame === 'yearly' ? 'yearly' : 'monthly';
    const data = await this.dashboardService.getActivityByType(businessId.trim(), tf);
    return { success: true, data };
  }
}
