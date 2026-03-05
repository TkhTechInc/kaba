import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseError } from '@/shared/errors/DomainError';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { Role } from './role.types';
import type { Permission } from './role.types';
import { roleHasPermission } from './role.types';

export interface BusinessAccess {
  businessId: string;
  role: Role;
}

@Injectable()
export class AccessService {
  constructor(
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly businessRepo: BusinessRepository,
  ) {}

  /**
   * Get user's role for a business.
   * Checks direct business membership first, then org membership if business has organizationId.
   */
  async getUserRole(businessId: string, userId: string): Promise<Role | null> {
    const direct = await this.teamMemberRepo.getByBusinessAndUser(businessId, userId);
    if (direct) return direct.role;

    const business = await this.businessRepo.getById(businessId);
    if (business?.organizationId) {
      const orgMember = await this.teamMemberRepo.getByOrgAndUser(business.organizationId, userId);
      if (orgMember) return orgMember.role;
    }

    return null;
  }

  /**
   * Check if user has the given permission for a business.
   */
  async canAccess(businessId: string, userId: string, permission: Permission): Promise<boolean> {
    const role = await this.getUserRole(businessId, userId);
    if (!role) return false;
    return roleHasPermission(role, permission);
  }

  /**
   * List all team members for a business. Caller must have members:manage permission.
   */
  async listMembers(businessId: string): Promise<Array<{ userId: string; role: Role; createdAt: string }>> {
    const members = await this.teamMemberRepo.listMembersForBusiness(businessId);
    return members
      .filter((m) => m.businessId)
      .map((m) => ({ userId: m.userId, role: m.role, createdAt: m.createdAt }));
  }

  /**
   * List all businesses the user has access to.
   */
  async listBusinessesForUser(userId: string): Promise<BusinessAccess[]> {
    const members = await this.teamMemberRepo.listBusinessesForUser(userId);
    return members
      .filter((m) => m.businessId)
      .map((m) => ({ businessId: m.businessId!, role: m.role }));
  }

  /**
   * Update a team member's role for a business. Caller must have members:manage permission.
   */
  async updateMemberRole(
    businessId: string,
    targetUserId: string,
    newRole: Role,
  ): Promise<BusinessAccess> {
    try {
      const updated = await this.teamMemberRepo.updateBusinessMemberRole(
        businessId,
        targetUserId,
        newRole,
      );
      return { businessId: updated.businessId!, role: updated.role };
    } catch (e) {
      if (e instanceof DatabaseError) {
        throw new NotFoundException('Team member not found');
      }
      throw e;
    }
  }
}
