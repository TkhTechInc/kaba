import { Controller, Post, Get, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiKeyService } from './ApiKeyService';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/api-keys')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('api_keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @RequirePermission('api_keys:write')
  async create(@Body() dto: CreateApiKeyDto, @AuditUserId() userId?: string) {
    const { apiKey, rawKey } = await this.apiKeyService.create({
      businessId: dto.businessId,
      name: dto.name,
      scopes: dto.scopes as import('./models/ApiKey').ApiKeyScope[],
      isTest: dto.isTest,
    }, userId);
    return {
      success: true,
      data: {
        ...apiKey,
        rawKey, // Only returned once on create
      },
    };
  }

  @Get()
  @RequirePermission('api_keys:read')
  async list(@Query('businessId') businessId: string) {
    const keys = await this.apiKeyService.list(businessId);
    return { success: true, data: keys };
  }

  @Delete(':id')
  @RequirePermission('api_keys:write')
  async revoke(
    @Param('id') id: string,
    @Query('businessId') businessId: string,
    @AuditUserId() userId?: string,
  ) {
    await this.apiKeyService.revoke(businessId, id, userId);
    return { success: true };
  }
}
