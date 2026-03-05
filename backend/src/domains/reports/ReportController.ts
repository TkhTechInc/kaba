import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './ReportService';
import { PdfExportService } from './PdfExportService';
import { ConsolidatedReportService } from './ConsolidatedReportService';
import { CreditScoreService } from './CreditScoreService';
import { ReportQueryDto } from './dto/report-query.dto';
import { AgingDebtQueryDto } from './dto/aging-debt-query.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { AccessService } from '@/domains/access/AccessService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { ValidationError } from '@/shared/errors/DomainError';

@Controller('api/v1/reports')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly pdfExport: PdfExportService,
    private readonly consolidatedReportService: ConsolidatedReportService,
    private readonly creditScoreService: CreditScoreService,
    private readonly accessService: AccessService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  @Get('pl')
  @Feature('reports')
  @RequirePermission('reports:read')
  async getPL(@Query() query: ReportQueryDto) {
    const report = await this.reportService.getPL(
      query.businessId,
      query.fromDate,
      query.toDate,
    );
    return { success: true, data: report };
  }

  @Get('pl/pdf')
  @Feature('reports_pdf')
  @RequirePermission('reports:read')
  async getPLPdf(@Query() query: ReportQueryDto, @Res() res: Response) {
    const report = await this.reportService.getPL(
      query.businessId,
      query.fromDate,
      query.toDate,
    );
    const pdf = await this.pdfExport.generatePLPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="pl-${query.fromDate}-${query.toDate}.pdf"`);
    res.send(pdf);
  }

  @Get('aging-debt')
  @Feature('reports')
  @RequirePermission('reports:read')
  async getAgingDebt(@Query() query: AgingDebtQueryDto) {
    const report = await this.reportService.getAgingDebt(
      query.businessId,
      query.asOfDate,
    );
    return { success: true, data: report };
  }

  @Get('cash-flow')
  @Feature('reports')
  @RequirePermission('reports:read')
  async getCashFlow(@Query() query: ReportQueryDto) {
    const report = await this.reportService.getCashFlow(
      query.businessId,
      query.fromDate,
      query.toDate,
    );
    return { success: true, data: report };
  }

  @Get('cash-flow/pdf')
  @Feature('reports_pdf')
  @RequirePermission('reports:read')
  async getCashFlowPdf(@Query() query: ReportQueryDto, @Res() res: Response) {
    const report = await this.reportService.getCashFlow(
      query.businessId,
      query.fromDate,
      query.toDate,
    );
    const pdf = await this.pdfExport.generateCashFlowPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="cash-flow-${query.fromDate}-${query.toDate}.pdf"`);
    res.send(pdf);
  }

  /**
   * Consolidated P&L across all branches in an organization.
   * Verifies that the requesting user has at least one role in the org.
   */
  @Get('consolidated')
  @Feature('reports')
  @RequirePermission('reports:read')
  async getConsolidatedPL(
    @Query('organizationId') organizationId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) {
      throw new ValidationError('Authentication required');
    }

    // Verify user has access to at least one business in the org
    const businesses = await this.businessRepository.listByOrganization(organizationId);
    if (businesses.length === 0) {
      throw new ValidationError('Organization not found or has no branches');
    }

    const roles = await Promise.all(
      businesses.map((b) => this.accessService.getUserRole(b.id, userId))
    );
    if (!roles.some((r) => r !== null)) {
      throw new ValidationError('Access denied to this organization');
    }

    const report = await this.consolidatedReportService.getConsolidatedPL(
      organizationId,
      fromDate,
      toDate,
    );
    return { success: true, data: report };
  }

  /**
   * Customer Trust Score for credit/lending decisions.
   * Feature-gated to ai_loan_readiness tier.
   */
  @Get('credit-score')
  @Feature('ai_loan_readiness')
  @RequirePermission('lending:read')
  async getCreditScore(
    @Query('businessId') businessId: string,
    @Query('customerId') customerId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    const result = await this.creditScoreService.getCreditScore(
      businessId,
      customerId,
      fromDate,
      toDate,
    );
    return { success: true, data: result };
  }
}
