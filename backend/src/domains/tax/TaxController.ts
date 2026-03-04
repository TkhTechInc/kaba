import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ITaxEngine } from './ITaxEngine';
import { TAX_ENGINE } from '@/nest/modules/tax/tax.tokens';
import { LedgerRepository } from '@/domains/ledger/repositories/LedgerRepository';
import type { TaxableTransaction } from './ITaxEngine';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/tax')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class TaxController {
  constructor(
    @Inject(TAX_ENGINE) private readonly taxEngine: ITaxEngine,
    private readonly ledgerRepo: LedgerRepository,
  ) {}

  @Get('vat')
  @Feature('tax')
  @RequirePermission('tax:read')
  async getVAT(
    @Query('businessId') businessId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('countryCode') countryCode: string,
  ) {
    const entries = await this.ledgerRepo.listByBusinessAndDateRange(
      businessId,
      fromDate,
      toDate,
    );

    const transactions: TaxableTransaction[] = entries.map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency,
      type: e.type,
    }));

    const summary = await this.taxEngine.calculateVAT(
      transactions,
      countryCode || 'NG',
      { start: fromDate, end: toDate },
    );

    return { success: true, data: summary };
  }

  @Get('countries')
  async getSupportedCountries() {
    return {
      success: true,
      data: { countries: this.taxEngine.getSupportedCountries() },
    };
  }
}
