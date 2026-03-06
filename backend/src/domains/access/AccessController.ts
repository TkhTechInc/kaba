import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AccessService } from './AccessService';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { CurrentUser } from '@/nest/common/decorators/current-user.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/access')
@Auth()
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('businesses')
  async listBusinesses(@CurrentUser('sub') userId: string) {
    const businesses = await this.accessService.listBusinessesForUser(userId);
    return { success: true, data: businesses };
  }

  /**
   * List organizations the user can access for consolidated P&L reports.
   * Requires owner or accountant role on at least one business in each org.
   */
  @Get('organizations')
  async listOrganizations(@CurrentUser('sub') userId: string) {
    const orgs = await this.accessService.listOrganizationsForConsolidatedReports(userId);
    return { success: true, data: orgs };
  }

  /**
   * List team members for a business. Requires members:manage permission.
   * GET /api/v1/access/businesses/:businessId/members
   */
  @Get('businesses/:businessId/members')
  @UseGuards(PermissionGuard)
  @RequirePermission('members:manage')
  async listMembers(@Param('businessId') businessId: string) {
    const members = await this.accessService.listMembers(businessId.trim());
    return { success: true, data: { members } };
  }

  /**
   * Update a team member's role. Requires members:manage permission (owner).
   * PATCH /api/v1/access/businesses/:businessId/members/:userId/role
   */
  @Patch('businesses/:businessId/members/:userId/role')
  @UseGuards(PermissionGuard)
  @RequirePermission('members:manage')
  async updateMemberRole(
    @Param('businessId') businessId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { role: 'owner' | 'manager' | 'accountant' | 'viewer' | 'sales' },
  ) {
    const role = body?.role;
    const valid: Array<'owner' | 'manager' | 'accountant' | 'viewer' | 'sales'> = ['owner', 'manager', 'accountant', 'viewer', 'sales'];
    if (!role || !valid.includes(role)) {
      throw new BadRequestException(`role must be one of: ${valid.join(', ')}`);
    }
    const result = await this.accessService.updateMemberRole(
      businessId.trim(),
      targetUserId.trim(),
      role,
    );
    return { success: true, data: result };
  }
}
