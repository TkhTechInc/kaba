import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  Inject,
  Optional,
} from '@nestjs/common';
import { BusinessRepository } from './BusinessRepository';
import { BusinessMemoryRepository } from './BusinessMemoryRepository';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import type { Tier } from '@/domains/features/feature.types';
import { IAuditLogger } from '../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../audit/AuditModule';

@Controller('api/v1/businesses')
@Auth()
@UseGuards(PermissionGuard)
export class BusinessController {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly memoryRepo: BusinessMemoryRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  @Patch('tier')
  @RequirePermission('business:tier')
  async updateTier(
    @Body() body: { businessId: string; tier: Tier },
    @AuditUserId() userId?: string,
  ) {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required');
    }
    const { businessId, tier } = body;
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const valid: Tier[] = ['free', 'starter', 'pro', 'enterprise'];
    if (!valid.includes(tier)) {
      throw new BadRequestException(`tier must be one of: ${valid.join(', ')}`);
    }
    const existing = await this.businessRepo.getById(businessId.trim());
    const business = await this.businessRepo.updateTier(businessId.trim(), tier);

    if (this.auditLogger && userId) {
      try {
        await this.auditLogger.log({
          entityType: 'Business',
          entityId: businessId.trim(),
          businessId: businessId.trim(),
          action: 'update',
          userId,
          changes: {
            tier: {
              from: existing?.tier ?? 'free',
              to: tier,
            },
          },
        });
      } catch (auditErr) {
        console.error('[BusinessController] Audit log failed:', auditErr);
      }
    }

    return { success: true, data: business };
  }

  @Patch(':id/settings')
  @RequirePermission('business:settings')
  async updateSettings(
    @Param('id') businessId: string,
    @Body() body: {
      dailySummaryEnabled?: boolean;
      agentMemory?: { defaultCurrency?: string; frequentProducts?: string[]; topCustomers?: string[] };
    },
  ) {
    const business = await this.businessRepo.updateSettings(businessId.trim(), {
      dailySummaryEnabled: body?.dailySummaryEnabled,
    });
    if (body?.agentMemory !== undefined) {
      await this.memoryRepo.update(businessId.trim(), body.agentMemory);
    }
    const memory = await this.memoryRepo.get(businessId.trim());
    return { success: true, data: { ...business, agentMemory: memory ?? undefined } };
  }
}
