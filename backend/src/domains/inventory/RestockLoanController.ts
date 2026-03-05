import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { IsString, IsIn } from 'class-validator';
import { RestockLoanService } from './services/RestockLoanService';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

class RespondToOfferDto {
  @IsString()
  businessId!: string;

  @IsIn(['accepted', 'rejected'])
  decision!: 'accepted' | 'rejected';
}

@Controller('api/v1/inventory')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('inventory_lite')
export class RestockLoanController {
  constructor(private readonly restockLoanService: RestockLoanService) {}

  /**
   * Predict when a product will run out of stock based on 30-day sales velocity.
   */
  @Get(':id/stockout-forecast')
  @RequirePermission('inventory:read')
  async getStockoutForecast(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    const forecast = await this.restockLoanService.predictStockout(businessId, id);
    return { success: true, data: forecast };
  }

  /**
   * Create a Sika Restock Credit loan offer for a low-stock product.
   */
  @Post(':id/restock-loan')
  @RequirePermission('inventory:write')
  async createRestockLoan(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
  ) {
    const offer = await this.restockLoanService.offerRestockLoan(businessId, id);
    return { success: true, data: offer };
  }

  /**
   * Accept or reject a restock loan offer.
   */
  @Patch('loans/:offerId')
  @RequirePermission('inventory:write')
  async respondToOffer(
    @Param('offerId') offerId: string,
    @Body() dto: RespondToOfferDto,
  ) {
    const offer = await this.restockLoanService.respondToOffer(
      dto.businessId,
      offerId,
      dto.decision
    );
    return { success: true, data: offer };
  }
}
