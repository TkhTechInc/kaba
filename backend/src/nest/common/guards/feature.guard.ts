import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { FEATURE_KEY } from '../decorators/feature.decorator';
import type { FeatureKey } from '@/domains/features/feature.types';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<FeatureKey>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!featureKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const businessId = this.extractBusinessId(request);
    if (!businessId?.trim()) {
      throw new ForbiddenException('businessId is required for this feature');
    }

    const business = await this.businessRepo.getOrCreate(businessId, 'free');
    const enabled = this.featureService.isEnabled(featureKey, business.tier);
    if (!enabled) {
      throw new ForbiddenException(
        `Feature "${featureKey}" is not available for your plan (${business.tier}). Upgrade to access.`,
      );
    }
    return true;
  }

  private extractBusinessId(request: Request): string | undefined {
    const user = (request as any).user;
    if (user?.sub === 'apikey' && user?.businessId) {
      return user.businessId;
    }
    const body = (request.body as Record<string, unknown>) || {};
    const query = (request.query as Record<string, unknown>) || {};
    return (body.businessId as string) ?? (query.businessId as string);
  }
}
