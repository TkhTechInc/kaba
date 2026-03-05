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
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { AdminMetricsService } from './AdminMetricsService';
import { AdminAIQueryService } from './AdminAIQueryService';
import { AdminGuard } from './AdminGuard';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AdminAIQueryDto } from './dto/admin-ai-query.dto';
import { CreateUserByPhoneDto } from './dto/create-user-by-phone.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AuditService } from '@/domains/audit/services/AuditService';
import { LeakageDetectionService } from './LeakageDetectionService';
import { FeatureService } from '@/domains/features/FeatureService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { UsageRepository } from '@/domains/usage/UsageRepository';
import { ReportService } from '@/domains/reports/ReportService';
import { ReceiptStorageService } from '@/domains/receipts/ReceiptStorageService';
import { UserRepository, getUserIdFromPhone } from '@/nest/modules/auth/repositories/UserRepository';
import type { Tier, FeatureKey } from '@/domains/features/feature.types';
import type { User } from '@/nest/modules/auth/entities/User.entity';

@Controller('api/v1/admin')
@Auth()
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly metricsService: AdminMetricsService,
    private readonly aiQueryService: AdminAIQueryService,
    private readonly auditService: AuditService,
    private readonly leakageDetectionService: LeakageDetectionService,
    private readonly featureService: FeatureService,
    private readonly businessRepo: BusinessRepository,
    private readonly userRepo: UserRepository,
    private readonly reportService: ReportService,
    private readonly usageRepo: UsageRepository,
    private readonly receiptStorage: ReceiptStorageService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async getDetailedHealth() {
    return this.metricsService.getDetailedHealth();
  }

  @Get('receipts/status')
  async getReceiptsStatus(): Promise<{
    configured: boolean;
    bucket?: string;
    region?: string;
    status?: 'ok' | 'unavailable';
  }> {
    const configured = this.receiptStorage.isConfigured();
    const bucket = this.config.get<string>('s3.receiptsBucket') || process.env['S3_RECEIPTS_BUCKET'] || undefined;
    const region = this.config.get<string>('region') || process.env['AWS_REGION'] || undefined;

    if (!configured || !bucket) {
      return { configured: false };
    }

    let status: 'ok' | 'unavailable' | undefined;
    try {
      const s3 = new S3Client({ region: region || 'af-south-1' });
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      status = 'ok';
    } catch {
      status = 'unavailable';
    }

    return { configured: true, bucket, region, status };
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

  @Get('leakage-report')
  async getLeakageReport(
    @Query('businessId') businessId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    const result = await this.leakageDetectionService.getLeakageReport(
      businessId,
      from,
      to,
    );
    return { success: true, data: result };
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

  @Patch('features/:key')
  async updateFeature(
    @Param('key') key: string,
    @Body() body: { enabled?: boolean; tiers?: Tier[]; limits?: Partial<Record<Tier, number>> },
  ) {
    const feature = this.featureService.updateFeature(key as FeatureKey, body);
    return { success: true, data: feature };
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

  @Get('debts/summary')
  async getDebtsSummary(
    @Query('limit') limit?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKey?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const safeLimit = isNaN(parsedLimit) ? 50 : Math.min(Math.max(parsedLimit, 1), 20);
    let parsedKey: Record<string, unknown> | undefined;
    if (lastEvaluatedKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey)) as Record<string, unknown>;
      } catch {
        // ignore invalid key
      }
    }

    const { items: businesses, lastEvaluatedKey: nextKey } =
      await this.metricsService.listBusinesses(safeLimit, parsedKey);

    const items: Array<{
      businessId: string;
      businessName?: string;
      totalCount: number;
      totalAmount: number;
      currency: string;
      buckets: Array<{ label: string; daysMin: number; daysMax: number; amount: number; count: number }>;
    }> = [];
    let platformTotalCount = 0;
    let platformTotalAmount = 0;

    for (const business of businesses) {
      try {
        const report = await this.reportService.getAgingDebt(business.id);
        items.push({
          businessId: business.id,
          businessName: business.name,
          totalCount: report.totalCount,
          totalAmount: report.totalAmount,
          currency: report.currency,
          buckets: report.buckets.map((b) => ({
            label: b.label,
            daysMin: b.daysMin,
            daysMax: b.daysMax,
            amount: b.amount,
            count: b.count,
          })),
        });
        platformTotalCount += report.totalCount;
        platformTotalAmount += report.totalAmount;
      } catch {
        items.push({
          businessId: business.id,
          businessName: business.name,
          totalCount: 0,
          totalAmount: 0,
          currency: business.currency ?? 'NGN',
          buckets: [],
        });
      }
    }

    return {
      success: true,
      data: {
        items,
        ...(nextKey && { lastEvaluatedKey: nextKey }),
        platformTotalCount,
        platformTotalAmount,
      },
    };
  }

  @Get('usage/summary')
  async getUsageSummary(
    @Query('limit') limit?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKey?: string,
    @Query('month') month?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const safeLimit = isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100);
    let parsedKey: Record<string, unknown> | undefined;
    if (lastEvaluatedKey) {
      try {
        parsedKey = JSON.parse(decodeURIComponent(lastEvaluatedKey)) as Record<string, unknown>;
      } catch {
        // ignore invalid key
      }
    }
    const monthParam = month && /^\d{4}-\d{2}$/.test(month) ? month : undefined;

    const { items: businesses, lastEvaluatedKey: nextKey } =
      await this.metricsService.listBusinesses(safeLimit, parsedKey);

    const items = await Promise.all(
      businesses.map(async (business) => {
        const [aiQueryCount, mobileMoneyReconCount] = await Promise.all([
          this.usageRepo.getAiQueryCount(business.id, monthParam),
          this.usageRepo.getMobileMoneyReconCount(business.id, monthParam),
        ]);
        const tier = business.tier ?? 'free';
        const aiQueryLimit = this.featureService.getLimit('ai_query', tier);
        const mobileMoneyReconLimit = this.featureService.getLimit('mobile_money_recon', tier);
        return {
          businessId: business.id,
          businessName: business.name,
          tier,
          aiQueryCount,
          aiQueryLimit,
          mobileMoneyReconCount,
          mobileMoneyReconLimit,
        };
      }),
    );

    const effectiveMonth =
      monthParam ??
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    return {
      success: true,
      data: {
        items,
        lastEvaluatedKey: nextKey,
        month: effectiveMonth,
      },
    };
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
   * List all users with pagination.
   * GET /api/v1/admin/users
   */
  @Get('users')
  async listUsers(
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
    const { items, lastEvaluatedKey: nextKey } = await this.userRepo.scanUsers(
      safeLimit,
      parsedKey,
    );
    return {
      success: true,
      data: {
        items: items.map((u) => ({
          id: u.id,
          phone: u.phone,
          email: u.email,
          role: u.role ?? 'user',
          createdAt: u.createdAt,
        })),
        ...(nextKey && { lastEvaluatedKey: nextKey }),
      },
    };
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
