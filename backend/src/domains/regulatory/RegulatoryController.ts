import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RegulatoryReportService } from './services/RegulatoryReportService';
import { ComplianceService } from '@/domains/compliance/ComplianceService';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Controller('api/v1/regulatory')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('reports')
export class RegulatoryController {
  constructor(
    private readonly regulatoryReportService: RegulatoryReportService,
    private readonly complianceService: ComplianceService,
  ) {}

  @Get('report')
  @RequirePermission('reports:read')
  async getReport(
    @Query('businessId') businessId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @AuditUserId() userId?: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId query parameter is required');
    }
    if (!from?.trim() || !ISO_DATE_RE.test(from)) {
      throw new BadRequestException('from must be a valid date in YYYY-MM-DD format');
    }
    if (!to?.trim() || !ISO_DATE_RE.test(to)) {
      throw new BadRequestException('to must be a valid date in YYYY-MM-DD format');
    }

    const period = { from, to };
    const report = await this.regulatoryReportService.generateReport(businessId, period);

    await this.complianceService
      .logComplianceEvent(businessId, userId ?? 'unknown', 'data.export', {
        reportType: 'regulatory',
        period,
      })
      .catch(() => {});

    return { success: true, data: report };
  }
}
