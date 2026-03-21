import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PayrollService } from './services/PayrollService';
import { PayrollReportService } from './services/PayrollReportService';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreatePayRunDto } from './dto/create-pay-run.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { Feature } from '@/nest/common/decorators/feature.decorator';

@Controller('api/v1/payroll')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly reportService: PayrollReportService,
  ) {}

  @Post('employees')
  @RequirePermission('ledger:write')
  async createEmployee(
    @Query('businessId') businessId: string,
    @Body() dto: CreateEmployeeDto,
    @AuditUserId() userId?: string,
  ) {
    const employee = await this.payrollService.createEmployee({
      businessId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      momoPhone: dto.momoPhone,
      grossSalary: dto.grossSalary,
      currency: dto.currency,
      countryCode: dto.countryCode,
      cnssNumber: dto.cnssNumber,
      employmentStartDate: dto.employmentStartDate,
    }, userId);
    return { success: true, data: employee };
  }

  @Get('employees')
  @RequirePermission('ledger:read')
  async listEmployees(
    @Query('businessId') businessId: string,
    @Query('status') status?: 'active' | 'inactive',
  ) {
    const employees = await this.payrollService.listEmployees(businessId, status);
    return { success: true, data: employees };
  }

  @Get('employees/:id')
  @RequirePermission('ledger:read')
  async getEmployee(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const employee = await this.payrollService.getEmployee(businessId, id);
    return { success: true, data: employee };
  }

  @Patch('employees/:id')
  @RequirePermission('ledger:write')
  async updateEmployee(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const employee = await this.payrollService.updateEmployee(businessId, id, dto);
    return { success: true, data: employee };
  }

  @Post('pay-runs')
  @Throttle({ expensive: { limit: 5, ttl: 60000 } })
  @RequirePermission('ledger:write')
  async createPayRun(
    @Query('businessId') businessId: string,
    @Body() dto: CreatePayRunDto,
    @AuditUserId() userId?: string,
  ) {
    const payRun = await this.payrollService.createPayRun(businessId, dto.periodMonth, userId);
    return { success: true, data: payRun };
  }

  @Post('pay-runs/:id/finalize')
  @Throttle({ expensive: { limit: 5, ttl: 60000 } })
  @RequirePermission('ledger:write')
  async finalizePayRun(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @AuditUserId() userId?: string,
  ) {
    const payRun = await this.payrollService.finalizePayRun(businessId, id, userId);
    return { success: true, data: payRun };
  }

  @Post('pay-runs/:id/pay')
  @Throttle({ expensive: { limit: 5, ttl: 60000 } })
  @RequirePermission('ledger:write')
  async payPayRun(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
    @AuditUserId() userId?: string,
  ) {
    const { payRun, failedLines } = await this.payrollService.payPayRun(businessId, id, userId);
    return { success: true, data: payRun, failedLines };
  }

  @Get('annual-summary')
  @RequirePermission('ledger:read')
  async getAnnualSummary(
    @Query('businessId') businessId: string,
    @Query('year') year: string,
  ) {
    const y = parseInt(year ?? String(new Date().getFullYear()), 10);
    const summary = await this.reportService.getAnnualSummary(businessId, y);
    return { success: true, data: summary };
  }

  @Get('pay-runs')
  @RequirePermission('ledger:read')
  async listPayRuns(
    @Query('businessId') businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const payRuns = await this.payrollService.listPayRuns(businessId, from, to);
    return { success: true, data: payRuns };
  }

  @Get('pay-runs/:id')
  @RequirePermission('ledger:read')
  async getPayRun(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const payRun = await this.payrollService.getPayRun(businessId, id);
    return { success: true, data: payRun };
  }

  @Get('pay-runs/:id/lines')
  @RequirePermission('ledger:read')
  async listPayRunLines(
    @Query('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    const lines = await this.payrollService.listPayRunLines(businessId, id);
    return { success: true, data: lines };
  }
}
