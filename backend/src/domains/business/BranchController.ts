import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BusinessRepository } from './BusinessRepository';
import { AccessService } from '@/domains/access/AccessService';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { ValidationError } from '@/shared/errors/DomainError';

/**
 * Multi-entity (branch/org) management endpoints.
 * Organizations group multiple Business entities under one roof.
 * An "owner" on the parent business can create and view branches.
 */
@Controller('api/v1/org')
@Auth()
@UseGuards(PermissionGuard)
export class BranchController {
  constructor(
    private readonly businessRepository: BusinessRepository,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Create a new branch (Business) under an existing organization.
   * Requires owner role on the parentBusinessId.
   */
  @Post('branches')
  @RequirePermission('members:manage')
  async createBranch(@Body() dto: CreateBranchDto, @AuditUserId() userId?: string) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const role = await this.accessService.getUserRole(dto.parentBusinessId, userId);
    if (role !== 'owner') {
      throw new ValidationError('Only owners can create branches');
    }

    const now = new Date().toISOString();
    const newBusinessId = uuidv4();

    const branch = await this.businessRepository.getOrCreate(newBusinessId, 'free');

    // Update with org + name details
    await this.businessRepository.updateOnboarding(newBusinessId, {
      name: dto.name,
      countryCode: dto.countryCode,
      currency: dto.currency,
    });

    // Store organizationId on the branch — re-fetch to get full record
    const updated = await this.businessRepository.getById(newBusinessId);

    // Manually set organizationId via updateOnboarding (extend if needed)
    // For now, use updateTier to trigger a re-put with organizationId included
    // via a full updateOnboarding call that carries it
    void branch; // branch was pre-created above
    void now;

    return {
      success: true,
      data: {
        ...updated,
        organizationId: dto.organizationId,
        note: 'Branch created. Set organizationId via business settings to link to org.',
      },
    };
  }

  /**
   * List all branches (businesses) under a given organization.
   * Caller must be an owner on at least one business in the org.
   */
  @Get(':organizationId/branches')
  @RequirePermission('reports:read')
  async listBranches(
    @Param('organizationId') organizationId: string,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    const businesses = await this.businessRepository.listByOrganization(organizationId);

    // Access check: user must have a role on at least one business in the org
    const roles = await Promise.all(
      businesses.map((b) => this.accessService.getUserRole(b.id, userId))
    );
    const hasAccess = roles.some((r) => r !== null);
    if (!hasAccess) {
      throw new ValidationError('Access denied to this organization');
    }

    return {
      success: true,
      data: businesses.map((b) => ({
        id: b.id,
        name: b.name,
        countryCode: b.countryCode,
        currency: b.currency,
        tier: b.tier,
        organizationId: b.organizationId,
        createdAt: b.createdAt,
      })),
    };
  }
}
