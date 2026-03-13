import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Public } from '@/nest/common/decorators/auth.decorator';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { PaymentsClient } from '@/domains/payments/services/PaymentsClient';
import { getBusinessCurrency } from '@/shared/utils/country-currency';
import { StorefrontPaymentService } from './StorefrontPaymentService';

interface InitiatePaymentBody {
  amount: number;
  currency?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
}

@Controller('api/v1/storefront')
export class StorefrontController {
  constructor(
    private readonly businessRepo: BusinessRepository,
    private readonly paymentsClient: PaymentsClient,
    private readonly storefrontPaymentService: StorefrontPaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Get('pay/:token')
  @Public()
  async getPayData(@Param('token') token: string) {
    const data = await this.storefrontPaymentService.getPayData(token);
    if (!data) throw new BadRequestException('Invalid or expired payment link');
    return { success: true, data };
  }

  @Get(':slug')
  @Public()
  async getStorefront(@Param('slug') slug: string) {
    const business = await this.businessRepo.getBySlug(slug);
    if (!business) throw new NotFoundException('Business not found');

    return {
      success: true,
      data: {
        name: business.name,
        description: business.description,
        logoUrl: business.logoUrl,
        currency: getBusinessCurrency(business),
        countryCode: business.countryCode,
        address: business.address,
        phone: business.phone,
        taxId: business.taxId,
      },
    };
  }

  @Post(':slug/pay')
  @Public()
  async initiatePayment(
    @Param('slug') slug: string,
    @Body() body: InitiatePaymentBody,
  ) {
    const business = await this.businessRepo.getBySlug(slug);
    if (!business) throw new NotFoundException('Business not found');

    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const currency = (body.currency ?? getBusinessCurrency(business)).toUpperCase();
    const checkoutCurrencies = ['XOF', 'XAF', 'GNF', 'GHS'];
    let useKkiaPay = false;
    let useMomo = false;
    try {
      const payConfig = await this.paymentsClient.getPayConfig(currency, business.countryCode);
      useKkiaPay = payConfig.useKkiaPayWidget;
      useMomo = payConfig.useMomoRequest;
    } catch {
      // TKH Payments unavailable
    }

    if ((useKkiaPay || useMomo) && checkoutCurrencies.includes(currency)) {
      const baseUrl = this.configService.get<string>('oauth.frontendUrl') ?? process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
      const checkout = await this.storefrontPaymentService.createCheckout(
        slug,
        body.amount,
        currency,
        baseUrl,
        {
          description: body.description,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
        },
      );
      return {
        success: true,
        data: {
          token: checkout.token,
          payUrl: checkout.payUrl,
          useKkiaPayWidget: checkout.useKkiaPayWidget,
          useMomoRequest: checkout.useMomoRequest,
          amount: checkout.amount,
          currency: checkout.currency,
        },
      };
    }

    const syntheticInvoiceId = `storefront-${randomUUID().slice(0, 8)}`;

    const result = await this.paymentsClient.createIntent({
      amount: body.amount,
      currency,
      country: business.countryCode,
      metadata: {
        appId: 'kaba',
        referenceId: syntheticInvoiceId,
        businessId: business.id,
        ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
        ...(body.customerName ? { customerName: body.customerName } : {}),
        ...(body.description ? { description: body.description } : {}),
      },
    });

    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Payment initiation failed');
    }

    return {
      success: true,
      data: {
        paymentUrl: result.paymentUrl,
        intentId: result.intentId,
      },
    };
  }

  @Post('pay/request-momo')
  @Public()
  async requestMoMo(@Body() body: { token: string; phone: string }) {
    const { token, phone } = body;
    if (!token?.trim() || !phone?.trim()) {
      throw new BadRequestException('token and phone are required');
    }
    const result = await this.storefrontPaymentService.requestMoMoPayment(token.trim(), phone.trim());
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
    const result = await this.storefrontPaymentService.confirmKkiaPayPayment(
      token.trim(),
      transactionId.trim(),
      intentId.trim(),
      redirectStatus?.trim(),
    );
    if (!result.success) {
      throw new BadRequestException(result.error ?? 'Payment confirmation failed');
    }
    return { success: true };
  }
}
