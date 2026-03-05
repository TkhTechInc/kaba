import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ITaxEngine } from './ITaxEngine';
import type { IFNEProvider } from './interfaces/IFNEProvider';
import type { IMECeFProvider } from './interfaces/IMECeFProvider';
import { TAX_ENGINE, FNE_PROVIDER, MECEF_PROVIDER } from '@/nest/modules/tax/tax.tokens';
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
    @Inject(FNE_PROVIDER) private readonly fneProvider: IFNEProvider,
    @Inject(MECEF_PROVIDER) private readonly mecefProvider: IMECeFProvider,
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

  @Get('fne/countries')
  @Feature('tax')
  @RequirePermission('tax:read')
  async getFNESupportedCountries() {
    return {
      success: true,
      data: { countries: this.fneProvider.getSupportedCountries() },
    };
  }

  @Post('fne/register')
  @Feature('tax')
  @RequirePermission('tax:read')
  async registerFNEInvoice(
    @Body() body: {
      countryCode: string;
      businessId: string;
      invoiceId: string;
      amount: number;
      currency: string;
      customerId?: string;
    },
  ) {
    const result = await this.fneProvider.registerInvoice(body.countryCode, {
      businessId: body.businessId,
      invoiceId: body.invoiceId,
      amount: body.amount,
      currency: body.currency,
      customerId: body.customerId,
    });
    return { success: true, data: result };
  }

  @Get('mecef/countries')
  @Feature('tax')
  @RequirePermission('tax:read')
  async getMECeFSupportedCountries() {
    return {
      success: true,
      data: { countries: this.mecefProvider.getSupportedCountries() },
    };
  }

  @Post('mecef/register')
  @Feature('tax')
  @RequirePermission('tax:read')
  async registerMECeFInvoice(
    @Body() body: {
      nim: string;
      ifu: string;
      client_ifu?: string;
      reference?: string;
      montant_ht: number;
      montant_tva: number;
      montant_ttc: number;
      type_facture: 'FV' | 'FA';
      date: string;
      items: Array<{
        nom: string;
        quantite: number;
        prix_unitaire_ht: number;
        montant_ht: number;
        montant_tva: number;
        montant_ttc: number;
      }>;
    },
  ) {
    const result = await this.mecefProvider.registerInvoice(body);
    return { success: true, data: result };
  }

  @Post('mecef/confirm')
  @Feature('tax')
  @RequirePermission('tax:read')
  async confirmMECeFInvoice(
    @Body() body: { token: string; decision: 'confirm' | 'reject' },
  ) {
    const result = await this.mecefProvider.confirmInvoice(body.token, body.decision);
    if (!result) {
      return {
        success: false,
        error: 'Token expired, already used, or decision was reject',
      };
    }
    return { success: true, data: result };
  }
}
