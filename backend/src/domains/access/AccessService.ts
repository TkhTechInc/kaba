import { Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { DatabaseError } from '@/shared/errors/DomainError';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { Role } from './role.types';
import type { Permission } from './role.types';
import { roleHasPermission } from './role.types';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';

export interface BusinessAccess {
  businessId: string;
  role: Role;
}

@Injectable()
export class AccessService {
  constructor(
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly businessRepo: BusinessRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
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
    actorUserId?: string,
  ): Promise<BusinessAccess> {
    try {
      const updated = await this.teamMemberRepo.updateBusinessMemberRole(
        businessId,
        targetUserId,
        newRole,
      );

      if (this.auditLogger && actorUserId) {
        this.auditLogger.log({
          entityType: 'access',
          entityId: `${businessId}#${targetUserId}`,
          businessId,
          action: 'update',
          userId: actorUserId,
          metadata: { targetUserId, newRole },
        }).catch(() => {});
      }

      return { businessId: updated.businessId!, role: updated.role };
    } catch (e) {
      if (e instanceof DatabaseError) {
        throw new NotFoundException('Team member not found');
      }
      throw e;
    }
  }

  /**
   * Remove a team member from a business. Logs access.revoke audit event.
   */
  async removeMember(
    businessId: string,
    targetUserId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await this.teamMemberRepo.getByBusinessAndUser(businessId, targetUserId);
    if (!existing) {
      throw new NotFoundException('Team member not found');
    }
    await this.teamMemberRepo.removeBusinessMember(businessId, targetUserId);

    if (this.auditLogger) {
      this.auditLogger.log({
        entityType: 'access',
        entityId: `${businessId}#${targetUserId}`,
        businessId,
        action: 'access.revoke',
        userId: actorUserId,
        metadata: { revokedUserId: targetUserId, role: existing.role },
      }).catch(() => {});
    }
  }
}
