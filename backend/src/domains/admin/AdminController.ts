import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Patch,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminMetricsService } from './AdminMetricsService';
import { AdminAIQueryService } from './AdminAIQueryService';
import { AdminGuard } from './AdminGuard';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AdminAIQueryDto } from './dto/admin-ai-query.dto';
import { CreateUserByPhoneDto } from './dto/create-user-by-phone.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AuditService } from '@/domains/audit/services/AuditService';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { UserRepository, getUserIdFromPhone } from '@/nest/modules/auth/repositories/UserRepository';
import type { Tier } from '@/domains/features/feature.types';
import type { User } from '@/nest/modules/auth/entities/User.entity';

@Controller('api/v1/admin')
@Auth()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly metricsService: AdminMetricsService,
    private readonly aiQueryService: AdminAIQueryService,
    private readonly auditService: AuditService,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
    private readonly userRepo: UserRepository,
  ) {}

  @Get('health')
  async getDetailedHealth() {
    return this.metricsService.getDetailedHealth();
  }

  @Get('metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('activity')
  async getActivity(
    @Query('limit') limit?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKey?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    let parsedKey: Record<string, unknown> | undefined;
    if (lastEvaluatedKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey)) as Record<string, unknown>;
      } catch {
        // ignore invalid key
      }
    }
    return this.metricsService.getActivity(safeLimit, parsedKey);
  }

  @Get('summary')
  async getSummary() {
    return this.metricsService.getSummary();
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('businessId') businessId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKey?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    let parsedKey: Record<string, unknown> | undefined;
    if (lastEvaluatedKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey)) as Record<string, unknown>;
      } catch {
        // ignore invalid key
      }
    }
    const result = await this.auditService.queryByBusiness(
      businessId ?? 'GLOBAL',
      from,
      to,
      safeLimit,
      parsedKey,
    );
    return {
      success: true,
      data: {
        items: result.items,
        lastEvaluatedKey: result.lastEvaluatedKey,
      },
    };
  }

  @Post('ai/query')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async aiQuery(@Body() dto: AdminAIQueryDto) {
    return this.aiQueryService.query(dto.query);
  }

  @Get('features')
  async getFeatures() {
    const features = this.featureService.getAllFeatures();
    return { success: true, data: features };
  }

  @Get('businesses')
  async listBusinesses(
    @Query('limit') limit?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKey?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 100);
    let parsedKey: Record<string, unknown> | undefined;
    if (lastEvaluatedKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey)) as Record<string, unknown>;
      } catch {
        // ignore invalid key
      }
    }
    return this.metricsService.listBusinesses(safeLimit, parsedKey);
  }

  @Patch('businesses/:id/tier')
  async updateBusinessTier(
    @Param('id') businessId: string,
    @Body() body: { tier: Tier },
  ) {
    const tier = body.tier;
    const valid: Tier[] = ['free', 'starter', 'pro', 'enterprise'];
    if (!tier || !valid.includes(tier)) {
      throw new BadRequestException(`tier must be one of: ${valid.join(', ')}`);
    }
    const business = await this.businessRepo.updateTier(businessId.trim(), tier);
    return { success: true, data: business };
  }

  /**
   * Create a user by phone number. User must be created before they can log in with phone.
   * POST /api/v1/admin/users/phone
   */
  @Post('users/phone')
  async createUserByPhone(@Body() dto: CreateUserByPhoneDto) {
    const phone = dto.phone.trim();
    const existing = await this.userRepo.getByPhone(phone);
    if (existing) {
      throw new ConflictException('A user with this phone number already exists');
    }
    const userId = getUserIdFromPhone(phone);
    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      phone,
      provider: 'phone',
      role: dto.role ?? 'user',
      createdAt: now,
      updatedAt: now,
    };
    await this.userRepo.create(user);
    return { success: true, data: { id: user.id, phone: user.phone, role: user.role } };
  }

  /**
   * Update a user's global role (admin | user).
   * PATCH /api/v1/admin/users/:id/role
   */
  @Patch('users/:id/role')
  async updateUserRole(@Param('id') userId: string, @Body() dto: UpdateUserRoleDto) {
    const user = await this.userRepo.getById(userId.trim());
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated: User = { ...user, role: dto.role, updatedAt: new Date().toISOString() };
    await this.userRepo.update(updated);
    return { success: true, data: { id: updated.id, role: updated.role } };
  }
}
