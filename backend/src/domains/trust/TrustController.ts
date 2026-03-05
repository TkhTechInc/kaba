import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  NotImplementedException,
} from '@nestjs/common';
import { Auth, Public } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { BusinessTrustScoreService } from './BusinessTrustScoreService';
import { MoMoReconciliationService } from './MoMoReconciliationService';
import { TrustShareService } from './TrustShareService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { AccessService } from '@/domains/access/AccessService';
import {
  MoMoUploadDto,
  TrustScoreQueryDto,
  TrustLookupDto,
  UpdateMarketDayDto,
} from './dto/trust.dto';

@Controller('api/v1/trust')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class TrustController {
  constructor(
    private readonly businessTrustScoreService: BusinessTrustScoreService,
    private readonly momoReconciliationService: MoMoReconciliationService,
    private readonly trustShareService: TrustShareService,
    private readonly businessRepository: BusinessRepository,
    private readonly usageRepository: UsageRepository,
    private readonly accessService: AccessService,
  ) {}

  private async requireBusinessAccess(businessId: string, userId: string | undefined): Promise<void> {
    if (!userId) throw new ForbiddenException('Authentication required');
    const role = await this.accessService.getUserRole(businessId, userId);
    if (!role) throw new ForbiddenException('Access denied to this business');
  }

  @Get('my-score')
  @Feature('trust_score')
  @RequirePermission('reports:read')
  async getMyScore(@Query() dto: TrustScoreQueryDto, @AuditUserId() userId?: string) {
    await this.requireBusinessAccess(dto.businessId, userId);
    const result = await this.businessTrustScoreService.calculateAndSave(dto.businessId);
    return { success: true, data: result };
  }

  @Post('momo-upload')
  @Feature('trust_score')
  @RequirePermission('ledger:write')
  async uploadMoMo(@Body() dto: MoMoUploadDto, @AuditUserId() userId?: string) {
    await this.requireBusinessAccess(dto.businessId, userId);
    const transactions = this.momoReconciliationService.parseSmsText(dto.smsText);
    const byMonth = this.momoReconciliationService.groupByMonth(transactions);

    const monthData = byMonth[dto.month] ?? { total: 0, count: 0, currency: dto.currency };
    const momoTotal = monthData.total;
    const rate = Math.min(1, dto.declaredTotal > 0 ? momoTotal / dto.declaredTotal : 0);

    const savedRecord = {
      businessId: dto.businessId,
      month: dto.month,
      momoTotal,
      declaredTotal: dto.declaredTotal,
      currency: dto.currency,
      rate,
      transactionCount: monthData.count,
      uploadedAt: new Date().toISOString(),
    };

    await this.momoReconciliationService.saveReconRecord(savedRecord);

    return { success: true, data: { transactions, savedRecord } };
  }

  @Post('share')
  @Feature('trust_share')
  @RequirePermission('reports:read')
  async shareScore(@Body() body: { businessId: string }, @AuditUserId() userId?: string) {
    await this.requireBusinessAccess(body.businessId, userId);
    const shareToken = await this.trustShareService.generateShareTokenWithLookup(body.businessId);
    return {
      success: true,
      data: {
        shareUrl: shareToken.shareUrl,
        token: shareToken.token,
        expiresAt: shareToken.expiresAt,
        trustScore: shareToken.trustScore,
      },
    };
  }

  @Get('view/:token')
  @Public()
  async viewPublicBadge(@Param('token') token: string) {
    const badge = await this.trustShareService.getPublicBadge(token);
    if (!badge) throw new NotFoundException('Trust badge not found or expired');
    return { success: true, data: badge };
  }

  @Get('lookup')
  @Feature('trust_lookup')
  @RequirePermission('reports:read')
  async lookupTrust(@Query() dto: TrustLookupDto, @AuditUserId() userId?: string) {
    if (!dto.businessId && dto.businessPhone) {
      throw new NotImplementedException('Phone lookup not yet supported');
    }

    if (userId && userId !== 'apikey') {
      await this.requireBusinessAccess(dto.businessId!, userId);
    }

    const businessId = dto.businessId!;
    const scoreResult = await this.businessTrustScoreService.calculateAndSave(businessId);

    await this.usageRepository.incrementAiQueries(businessId);

    const publicBadge = {
      trustScore: scoreResult.trustScore,
      recommendation: scoreResult.recommendation,
      scoredAt: scoreResult.scoredAt,
      badge:
        scoreResult.trustScore >= 80
          ? ('gold' as const)
          : scoreResult.trustScore >= 60
            ? ('silver' as const)
            : scoreResult.trustScore >= 40
              ? ('bronze' as const)
              : ('unrated' as const),
    };

    return { success: true, data: publicBadge };
  }

  @Post('market-day')
  @Feature('trust_score')
  @RequirePermission('ledger:write')
  async updateMarketDay(@Body() dto: UpdateMarketDayDto, @AuditUserId() userId?: string) {
    await this.requireBusinessAccess(dto.businessId, userId);
    await this.businessRepository.updateOnboarding(dto.businessId, {
      marketDayCycle: dto.marketDayCycle,
    });
    return { success: true, message: 'Market day cycle updated' };
  }
}
