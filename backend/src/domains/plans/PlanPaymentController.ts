import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsIn, IsString } from 'class-validator';
import { PlanPaymentService } from './PlanPaymentService';
import { Auth, Public } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import type { Tier } from '@/domains/features/feature.types';

class CheckoutDto {
  @IsString()
  businessId!: string;

  @IsIn(['starter', 'pro', 'enterprise'])
  targetTier!: Tier;
}

@Controller('api/v1/plans')
export class PlanPaymentController {
  constructor(
    private readonly planPaymentService: PlanPaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('checkout')
  @Auth()
  @UseGuards(PermissionGuard)
  @RequirePermission('business:tier')
  async checkout(@Body() dto: CheckoutDto) {
    if (!dto.businessId?.trim() || !dto.targetTier) {
      throw new BadRequestException('businessId and targetTier are required');
    }
    const baseUrl = this.configService.get<string>('oauth.frontendUrl') ?? process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
    const result = await this.planPaymentService.createCheckout(
      dto.businessId.trim(),
      dto.targetTier,
      baseUrl,
    );
    return { success: true, data: result };
  }

  @Get('pay/:token')
  @Public()
  async getPayData(@Param('token') token: string) {
    const data = await this.planPaymentService.getPayData(token);
    if (!data) throw new BadRequestException('Invalid or expired payment link');
    return { success: true, data };
  }

  @Post('pay/request-momo')
  @Public()
  async requestMoMo(@Body() body: { token: string; phone: string }) {
    const { token, phone } = body;
    if (!token?.trim() || !phone?.trim()) {
      throw new BadRequestException('token and phone are required');
    }
    const result = await this.planPaymentService.requestMoMoPayment(token.trim(), phone.trim());
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'MoMo payment request failed');
    }
    return { success: true, message: 'Payment request sent to your phone. Please approve on your MoMo app.' };
  }

  @Post('pay/confirm-kkiapay')
  @Public()
  async confirmKkiaPay(@Body() body: { token: string; transactionId: string; intentId: string; redirectStatus?: string }) {
    const { token, transactionId, intentId, redirectStatus } = body;
    if (!token?.trim() || !transactionId?.trim() || !intentId?.trim()) {
      throw new BadRequestException('token, transactionId and intentId are required');
    }
    const result = await this.planPaymentService.confirmKkiaPayPayment(
      token.trim(),
      transactionId.trim(),
      intentId.trim(),
      redirectStatus?.trim(),
    );
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Payment confirmation failed');
    }
    return { success: true, businessId: result.businessId };
  }
}
