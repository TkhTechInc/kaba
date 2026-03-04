import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FeatureService } from './FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import type { FeatureKey } from './feature.types';

@Controller('api/v1/features')
@Auth()
@UseGuards(PermissionGuard)
export class FeaturesController {
  constructor(
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
  ) {}

  /**
   * Get enabled features and limits for a business. Used by frontend to show/hide UI.
   * GET /api/v1/features?businessId=xxx
   */
  @Get()
  @RequirePermission('features:read')
  async getForBusiness(@Query('businessId') businessId: string) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const business = await this.businessRepo.getOrCreate(businessId.trim(), 'free');
    const all = this.featureService.getAllFeatures();
    const enabled: Record<string, boolean> = {};
    const limits: Record<string, number | undefined> = {};

    for (const key of Object.keys(all) as FeatureKey[]) {
      enabled[key] = this.featureService.isEnabled(key, business.tier);
      limits[key] = this.featureService.getLimit(key, business.tier);
    }

    return {
      success: true,
      data: {
        tier: business.tier,
        onboardingComplete: business.onboardingComplete ?? false,
        currency: business.currency ?? 'NGN',
        enabled,
        limits,
      },
    };
  }
}
