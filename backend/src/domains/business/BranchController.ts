import { Controller, Get, Post, Delete, Body, Param, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IsString, MaxLength, IsEmail, IsIn, IsOptional } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';
import { BusinessRepository } from './BusinessRepository';
import { AccessService } from '@/domains/access/AccessService';
import { TeamMemberRepository } from '@/domains/access/repositories/TeamMemberRepository';
import { InvitationService } from '@/domains/access/InvitationService';
import { CreateBranchDto } from './dto/create-branch.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';
import { AuditUserId } from '@/nest/common/decorators/audit-user-id.decorator';
import { ValidationError } from '@/shared/errors/DomainError';
import type { Role } from '@/domains/access/role.types';

class CreateOrganizationDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  /** The calling user's current businessId — used to verify owner role and link as first branch. */
  @IsString()
  businessId!: string;
}

class InviteToBranchDto {
  @IsString()
  emailOrPhone!: string;

  @IsIn(['owner', 'manager', 'accountant', 'viewer', 'sales'])
  role!: Role;

  @IsOptional()
  expiresInHours?: number;
}

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
    private readonly teamMemberRepository: TeamMemberRepository,
    private readonly invitationService: InvitationService,
  ) {}

  /**
   * Create a new organization. The caller's business becomes the first branch.
   * Caller must be an owner of their business.
   */
  @Post()
  @RequirePermission('members:manage')
  async createOrganization(@Body() dto: CreateOrganizationDto, @AuditUserId() userId?: string) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }
    if (!dto.name?.trim()) {
      throw new ValidationError('Organization name is required');
    }
    const org = await this.accessService.createOrganization(dto.name, dto.businessId, userId);
    return { success: true, data: org };
  }

  /**
   * List all organizations the calling user can access (owner or accountant on a branch).
   * No businessId context needed — access is derived from the user's own memberships.
   */
  @Get()
  async listOrganizations(@AuditUserId() userId?: string) {
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }
    const orgs = await this.accessService.listOrganizationsForConsolidatedReports(userId);
    return { success: true, data: orgs };
  }

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

    const newBusinessId = uuidv4();

    await this.businessRepository.getOrCreate(newBusinessId, 'free');

    const updated = await this.businessRepository.updateOnboarding(newBusinessId, {
      name: dto.name,
      countryCode: dto.countryCode,
      currency: dto.currency,
      organizationId: dto.organizationId,
    });

    // Grant the creating user owner access on the new branch
    await this.teamMemberRepository.addBusinessMember({
      businessId: newBusinessId,
      userId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        countryCode: updated.countryCode,
        currency: updated.currency,
        organizationId: updated.organizationId,
        tier: updated.tier,
        createdAt: updated.createdAt,
      },
    };
  }

  /**
   * List all branches (businesses) under a given organization.
   * Access is enforced inline: the user must have a role on at least one branch in the org.
   * No businessId header needed — we authorise via org membership lookup.
   */
  @Get(':organizationId/branches')
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

  /**
   * Unlink a branch from its organization (clears organizationId).
   * Only org-level owners may do this. The branch continues to exist as a standalone business.
   */
  @Delete(':organizationId/branches/:branchId')
  async unlinkBranch(
    @Param('organizationId') organizationId: string,
    @Param('branchId') branchId: string,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) return { success: false, error: 'Authentication required' };

    const role = await this.accessService.getUserRole(branchId, userId);
    if (role !== 'owner') throw new ForbiddenException('Only owners can unlink branches');

    const branch = await this.businessRepository.getById(branchId);
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.organizationId !== organizationId) {
      throw new ValidationError('Branch does not belong to this organization');
    }

    await this.businessRepository.unlinkFromOrganization(branchId);
    return { success: true };
  }

  /**
   * List team members of a specific branch.
   * Caller must have owner or accountant role on that branch.
   */
  @Get(':organizationId/branches/:branchId/members')
  async listBranchMembers(
    @Param('organizationId') organizationId: string,
    @Param('branchId') branchId: string,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) return { success: false, error: 'Authentication required' };

    const role = await this.accessService.getUserRole(branchId, userId);
    if (!role) throw new ForbiddenException('Access denied');

    // Verify branch belongs to the org
    const branch = await this.businessRepository.getById(branchId);
    if (!branch || branch.organizationId !== organizationId) {
      throw new NotFoundException('Branch not found in this organization');
    }

    const members = await this.accessService.listMembers(branchId);
    return { success: true, data: members };
  }

  /**
   * Invite a user to a specific branch by email or phone.
   * Caller must be an owner on that branch.
   */
  @Post(':organizationId/branches/:branchId/members/invite')
  async inviteToBranch(
    @Param('organizationId') organizationId: string,
    @Param('branchId') branchId: string,
    @Body() dto: InviteToBranchDto,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) return { success: false, error: 'Authentication required' };

    const role = await this.accessService.getUserRole(branchId, userId);
    if (role !== 'owner') throw new ForbiddenException('Only owners can invite members');

    const branch = await this.businessRepository.getById(branchId);
    if (!branch || branch.organizationId !== organizationId) {
      throw new NotFoundException('Branch not found in this organization');
    }

    const invitation = await this.invitationService.create({
      emailOrPhone: dto.emailOrPhone.trim(),
      businessId: branchId,
      role: dto.role,
      invitedBy: userId,
      expiresInHours: dto.expiresInHours,
    });

    return { success: true, data: { id: invitation.id, token: invitation.token, expiresAt: invitation.expiresAt } };
  }

  /**
   * Remove a member from a specific branch.
   * Caller must be an owner on that branch, and cannot remove themselves.
   */
  @Delete(':organizationId/branches/:branchId/members/:targetUserId')
  async removeBranchMember(
    @Param('organizationId') organizationId: string,
    @Param('branchId') branchId: string,
    @Param('targetUserId') targetUserId: string,
    @AuditUserId() userId?: string,
  ) {
    if (!userId) return { success: false, error: 'Authentication required' };
    if (targetUserId === userId) throw new ValidationError('You cannot remove yourself');

    const role = await this.accessService.getUserRole(branchId, userId);
    if (role !== 'owner') throw new ForbiddenException('Only owners can remove members');

    const branch = await this.businessRepository.getById(branchId);
    if (!branch || branch.organizationId !== organizationId) {
      throw new NotFoundException('Branch not found in this organization');
    }

    await this.teamMemberRepository.removeBusinessMember(branchId, targetUserId);
    return { success: true };
  }
}
