import { Controller, Post, Body, BadRequestException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { AdminGuard } from '@/domains/admin/AdminGuard';
import { AgentOrchestrator } from './AgentOrchestrator';
import { McpChatDto, McpPortalChatDto, McpAdminChatDto } from './dto/mcp-chat.dto';

@Controller('api/v1/mcp')
@Throttle({ default: { ttl: 60000, limit: 30 } })
export class McpController {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  @Post('chat')
  @Auth()
  async chat(
    @Body() dto: McpChatDto,
    @AuditUserId() userId?: string,
  ) {
    const result = await this.orchestrator.chat({
      sessionId: dto.sessionId ?? '',
      message: dto.message,
      businessId: dto.businessId,
      userId,
      tier: dto.tier ?? 'starter',
      scope: 'business',
      locale: dto.locale,
    });
    return { success: true, data: result };
  }

  @Post('portal/chat')
  async portalChat(@Body() dto: McpPortalChatDto) {
    if (!dto.businessId?.trim()) {
      throw new BadRequestException('businessId is required');
    }
    if (!dto.customerEmail?.trim()) {
      throw new BadRequestException('customerEmail is required');
    }
    const result = await this.orchestrator.chat({
      sessionId: dto.sessionId ?? '',
      message: dto.message,
      businessId: dto.businessId,
      customerEmail: dto.customerEmail,
      tier: 'free',
      scope: 'customer',
      locale: dto.locale,
    });
    return { success: true, data: result };
  }

  @Post('admin/chat')
  @Auth()
  @UseGuards(AdminGuard)
  async adminChat(
    @Body() dto: McpAdminChatDto,
    @AuditUserId() userId?: string,
  ) {
    const result = await this.orchestrator.chat({
      sessionId: dto.sessionId ?? '',
      message: dto.message,
      businessId: 'ADMIN',
      userId,
      tier: 'enterprise',
      scope: 'admin',
    });
    return { success: true, data: result };
  }
}
