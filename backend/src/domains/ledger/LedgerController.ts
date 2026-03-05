import { Controller, Delete, Get, Post, Body, Query, Param, UseGuards } from '@nestjs/common';
import { LedgerService } from './services/LedgerService';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { ListEntriesQueryDto } from './dto/list-entries-query.dto';
import { BalanceQueryDto } from './dto/balance-query.dto';
import { LockPeriodDto } from './dto/lock-period.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';

@Controller('api/v1/ledger')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('ledger')
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly businessRepository: BusinessRepository,
  ) {}

  @Post('entries')
  @RequirePermission('ledger:write')
  async createEntry(
    @Body() dto: CreateLedgerEntryDto,
    @AuditUserId() userId?: string
  ) {
    const entry = await this.ledgerService.createEntry(
      {
        businessId: dto.businessId,
        type: dto.type,
        amount: dto.amount ?? 0,
        currency: dto.currency,
        description: dto.description ?? '',
        category: dto.category ?? '',
        date: dto.date,
        smsPhone: dto.smsPhone,
        productId: dto.productId,
        quantitySold: dto.quantitySold,
        originalCurrency: dto.originalCurrency,
        exchangeRate: dto.exchangeRate,
        forexGainLoss: dto.forexGainLoss,
      },
      userId
    );
    return { success: true, data: entry };
  }

  @Get('entries')
  @RequirePermission('ledger:read')
  async listEntries(@Query() query: ListEntriesQueryDto) {
    const result = await this.ledgerService.listEntries(
      query.businessId,
      query.page ?? 1,
      query.limit ?? 20
    );
    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get('balance')
  @RequirePermission('ledger:read')
  async getBalance(@Query() query: BalanceQueryDto) {
    const balance = await this.ledgerService.getBalance(query.businessId);
    return { success: true, data: balance };
  }

  /**
   * OHADA period lock — closes a fiscal month. Only owners can lock periods.
   * Once locked, entries in that month cannot be deleted (only reversed).
   */
  @Post('lock-period')
  @RequirePermission('business:settings')
  async lockPeriod(@Body() dto: LockPeriodDto) {
    const period = `${dto.year}-${String(dto.month).padStart(2, '0')}`;
    await this.businessRepository.lockPeriod(dto.businessId, period);
    return { success: true, data: { period, locked: true } };
  }

  @Get('locked-periods')
  @RequirePermission('ledger:read')
  async getLockedPeriods(@Query('businessId') businessId: string) {
    const periods = await this.businessRepository.getLockedPeriods(businessId);
    return { success: true, data: { lockedPeriods: periods } };
  }

  @Delete('entries/:id')
  @RequirePermission('ledger:delete')
  async softDeleteEntry(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @AuditUserId() userId?: string
  ) {
    await this.ledgerService.softDeleteEntry(businessId, id, userId);
    return { success: true };
  }
}
