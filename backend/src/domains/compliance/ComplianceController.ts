import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '@/nest/common/guards/jwt-auth.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { ComplianceService, ErasureResult } from './ComplianceService';
import { getComplianceForRegion } from '@/shared/compliance/RegionalCompliance';
import type { AuthUser } from '@/nest/common/types/auth.types';
import { ErasureDto } from './dto/erasure.dto';

@Controller('api/v1/compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /** Get regional compliance rules (NDPR, Ghana DPA, ECOWAS). */
  @Get('region')
  getRegion(@Query('countryCode') countryCode: string) {
    return getComplianceForRegion(countryCode || 'ECOWAS');
  }

  /**
   * Export business data (right to portability).
   * Requires auth + owner or business:settings.
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('business:settings')
  async export(
    @Query('businessId') businessId: string,
    @Request() req: { user: AuthUser },
  ) {
    if (!businessId?.trim()) {
      throw new ForbiddenException('businessId is required');
    }
    const data = await this.complianceService.exportBusinessData(businessId);
    await this.complianceService.logComplianceEvent(
      businessId,
      req.user.sub,
      'data.export',
      { exportedAt: data.exportedAt },
    );
    return data;
  }

  /**
   * Erase business data (right to be forgotten).
   * Requires owner only. Body: { businessId, confirm: true }.
   */
  @Post('erasure')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('compliance:erasure')
  async erasure(
    @Body() dto: ErasureDto,
    @Request() req: { user: AuthUser },
  ): Promise<ErasureResult> {
    if (!dto.businessId?.trim()) {
      throw new ForbiddenException('businessId is required');
    }
    if (dto.confirm !== true) {
      throw new ForbiddenException('confirm: true is required to proceed');
    }
    const result = await this.complianceService.eraseBusinessData(dto.businessId);
    await this.complianceService.logComplianceEvent(
      dto.businessId,
      req.user.sub,
      'data.erasure',
      {
        erasedAt: result.erasedAt,
        customersAnonymized: result.customersAnonymized,
        ledgerEntriesSoftDeleted: result.ledgerEntriesSoftDeleted,
        invoicesSoftDeleted: result.invoicesSoftDeleted,
      },
    );
    return result;
  }
}
