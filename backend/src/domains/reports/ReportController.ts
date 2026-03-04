import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './ReportService';
import { PdfExportService } from './PdfExportService';
import { ReportQueryDto } from './dto/report-query.dto';
import { AgingDebtQueryDto } from './dto/aging-debt-query.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';

@Controller('api/v1/reports')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly pdfExport: PdfExportService,
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
}
