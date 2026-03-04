import { Controller, Post, Get, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { WebhookService } from './WebhookService';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import type { WebhookEvent } from './models/Webhook';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/webhooks')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @RequirePermission('webhooks:write')
  async register(@Body() dto: CreateWebhookDto, @AuditUserId() userId?: string) {
    const webhook = await this.webhookService.register({
      businessId: dto.businessId,
      url: dto.url,
      secret: dto.secret,
      events: dto.events as WebhookEvent[],
    }, userId);
    return { success: true, data: { ...webhook, secret: '***' } };
  }

  @Get()
  @RequirePermission('webhooks:read')
  async list(@Query('businessId') businessId: string) {
    const webhooks = await this.webhookService.list(businessId);
    return { success: true, data: webhooks };
  }

  @Delete(':id')
  @RequirePermission('webhooks:write')
  async unregister(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @AuditUserId() userId?: string,
  ) {
    await this.webhookService.unregister(businessId, id, userId);
    return { success: true };
  }
}
