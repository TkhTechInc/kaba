import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ReconciliationService } from './services/ReconciliationService';
import { MobileMoneyReconDto } from './dto/mobile-money-recon.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';

@Controller('api/v1/reconciliation')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('mobile-money')
  @Feature('mobile_money_recon')
  @RequirePermission('ledger:write')
  async mobileMoney(@Body() dto: MobileMoneyReconDto, @AuditUserId() userId?: string) {
    const result = await this.reconciliationService.reconcileFromSms(
      dto.businessId,
      dto.smsText,
      userId,
    );
    return { success: true, data: result };
  }
}
