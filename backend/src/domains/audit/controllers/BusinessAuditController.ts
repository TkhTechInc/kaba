import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { AuditService } from '../services/AuditService';
import { AuditAnomalyService } from '../services/AuditAnomalyService';
import type { JwtPayload } from '@/nest/common/types/auth.types';

/** Default anomaly summary window when no date range is supplied: 30 days. */
const DEFAULT_ANOMALY_DAYS = 30;

function parseLimit(val: string | undefined, defaultVal: number, max: number): number {
  if (val === undefined || val === '') return defaultVal;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

function parseLastEvaluatedKey(val: string | undefined): Record<string, unknown> | undefined {
  if (!val?.trim()) return undefined;
  try {
    const parsed = JSON.parse(val) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Derive a 30-day window ending now when no explicit range given. */
function defaultDateRange(from?: string, to?: string): { from: string; to: string } {
  if (from && to) return { from, to };
  const now = new Date();
  const start = new Date(now.getTime() - DEFAULT_ANOMALY_DAYS * 24 * 60 * 60 * 1000);
  return {
    from: start.toISOString(),
    to: now.toISOString(),
  };
}

@Controller('api/v1/audit')
@Auth()
export class BusinessAuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditAnomalyService: AuditAnomalyService,
  ) {}

  /**
   * Activity feed for the caller's business.
   * businessId is read from query param (required for PermissionGuard + tenant isolation).
   */
  @Get('activity')
  @UseGuards(PermissionGuard)
  @RequirePermission('audit:read')
  async getActivity(
    @Request() req: { user: JwtPayload },
    @Query('businessId') businessIdParam?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKeyStr?: string,
  ) {
    const businessId = businessIdParam?.trim() || this.extractBusinessId(req.user);
    const limit = parseLimit(limitStr, 50, 100);
    const lastEvaluatedKey = parseLastEvaluatedKey(lastEvaluatedKeyStr);
    const result = await this.auditService.queryByBusiness(
      businessId,
      from?.trim() || undefined,
      to?.trim() || undefined,
      limit,
      lastEvaluatedKey,
    );
    return { success: true, data: { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey } };
  }

  /**
   * Audit logs for a specific user within the caller's business.
   * Results are DB-filtered by businessId — no post-hoc application filtering.
   */
  @Get('by-user')
  @UseGuards(PermissionGuard)
  @RequirePermission('audit:read')
  async getByUser(
    @Request() req: { user: JwtPayload },
    @Query('businessId') businessIdParam?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKeyStr?: string,
  ) {
    if (!userId?.trim()) {
      throw new BadRequestException('userId is required');
    }
    const businessId = businessIdParam?.trim() || this.extractBusinessId(req.user);
    const limit = parseLimit(limitStr, 50, 100);
    const lastEvaluatedKey = parseLastEvaluatedKey(lastEvaluatedKeyStr);
    const result = await this.auditService.queryByUserId(
      userId,
      businessId,
      from?.trim() || undefined,
      to?.trim() || undefined,
      limit,
      lastEvaluatedKey,
    );
    return { success: true, data: { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey } };
  }

  /**
   * Full history for a specific entity within the caller's business.
   * Results are DB-filtered by businessId.
   */
  @Get('by-entity')
  @UseGuards(PermissionGuard)
  @RequirePermission('audit:read')
  async getByEntity(
    @Request() req: { user: JwtPayload },
    @Query('businessId') businessIdParam?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitStr?: string,
    @Query('lastEvaluatedKey') lastEvaluatedKeyStr?: string,
  ) {
    if (!entityId?.trim()) {
      throw new BadRequestException('entityId is required');
    }
    const businessId = businessIdParam?.trim() || this.extractBusinessId(req.user);
    const limit = parseLimit(limitStr, 50, 100);
    const lastEvaluatedKey = parseLastEvaluatedKey(lastEvaluatedKeyStr);
    const result = await this.auditService.queryByEntityId(
      entityId,
      businessId,
      from?.trim() || undefined,
      to?.trim() || undefined,
      limit,
      lastEvaluatedKey,
    );
    return { success: true, data: { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey } };
  }

  /**
   * Anomaly summary (leakage, failed logins, deletes, last activity per user).
   * Defaults to the last 30 days if no date range is provided.
   */
  @Get('anomaly-summary')
  @UseGuards(PermissionGuard)
  @RequirePermission('audit:read')
  async getAnomalySummary(
    @Request() req: { user: JwtPayload },
    @Query('businessId') businessIdParam?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const businessId = businessIdParam?.trim() || this.extractBusinessId(req.user);
    const range = defaultDateRange(from?.trim() || undefined, to?.trim() || undefined);
    const result = await this.auditAnomalyService.getAnomalySummary(
      businessId,
      range.from,
      range.to,
    );
    return { success: true, data: result };
  }

  /**
   * Extract businessId from JWT sub + businessId claim.
   * The JWT businessId field is optional (multi-tenant: user picks business per request).
   * Fall back to sub (userId) only as a last resort — callers should always include businessId.
   */
  private extractBusinessId(user: JwtPayload): string {
    const biz = user.businessId ?? user.organizationId;
    if (!biz?.trim()) {
      throw new BadRequestException(
        'businessId must be present in the JWT or provided via the Authorization header context',
      );
    }
    return biz;
  }
}
