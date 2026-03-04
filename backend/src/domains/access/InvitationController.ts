import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { InvitationService } from './InvitationService';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { CurrentUser } from '@/nest/common/decorators/current-user.decorator';

@Controller('api/v1/invitations')
@Auth()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('invitations:manage')
  async create(@Body() dto: CreateInvitationDto, @CurrentUser('sub') userId: string) {
    const invitation = await this.invitationService.create({
      emailOrPhone: dto.emailOrPhone,
      businessId: dto.businessId,
      role: dto.role,
      invitedBy: userId,
      expiresInHours: dto.expiresInHours,
    });
    return { success: true, data: invitation };
  }

  @Post('accept')
  async accept(@Body() dto: AcceptInvitationDto, @CurrentUser('sub') userId: string) {
    const result = await this.invitationService.accept({
      token: dto.token,
      userId,
    });
    return result;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('invitations:manage')
  async list(@Query('businessId') businessId: string) {
    if (!businessId?.trim()) {
      return { success: true, data: [] };
    }
    const invitations = await this.invitationService.listByBusiness(businessId);
    return { success: true, data: invitations };
  }
}
