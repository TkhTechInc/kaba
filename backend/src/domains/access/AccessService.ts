import { Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { DatabaseError } from '@/shared/errors/DomainError';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import type { Role } from './role.types';
import type { Permission } from './role.types';
import { roleHasPermission } from './role.types';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/interfaces/IAuditLogger';

export interface BusinessAccess {
  businessId: string;
  role: Role;
}

export interface OrganizationAccess {
  id: string;
  name: string;
}

const ORG_LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const orgListCache = new Map<string, { data: OrganizationAccess[]; expiresAt: number }>();

@Injectable()
export class AccessService {
  constructor(
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly organizationRepo: OrganizationRepository,
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
   * Create a new organization and link the given business to it as its first branch.
   * The calling user is added as org-level owner.
   */
  async createOrganization(
    name: string,
    businessId: string,
    userId: string,
  ): Promise<OrganizationAccess> {
    const role = await this.getUserRole(businessId, userId);
    if (role !== 'owner') {
      throw new Error('Only owners can create organizations');
    }

    const org = await this.organizationRepo.create({ name: name.trim() });

    // Link the founding business to the org
    await this.businessRepo.updateOnboarding(businessId, { organizationId: org.id });

    // Add user as org-level owner so they can access all branches
    await this.teamMemberRepo.addOrgMember({
      organizationId: org.id,
      userId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });

    // Bust the org list cache for this user
    orgListCache.delete(userId);

    return { id: org.id, name: org.name };
  }

  /**
   * List organizations the user can access for consolidated reports.
   * User must have owner or accountant role on at least one business in the org.
   * Results are cached for 5 minutes per user.
   */
  async listOrganizationsForConsolidatedReports(userId: string): Promise<OrganizationAccess[]> {
    const cached = orgListCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const members = await this.teamMemberRepo.listBusinessesForUser(userId);
    const authorizedRoles: Role[] = ['owner', 'manager', 'accountant'];
    const eligible = members.filter(
      (m) => m.businessId && authorizedRoles.includes(m.role),
    );

    const businesses = await Promise.all(
      eligible.map((m) => this.businessRepo.getById(m.businessId!)),
    );
    const orgIds = new Set<string>(
      businesses
        .map((b) => b?.organizationId)
        .filter((id): id is string => id != null),
    );

    const orgResults = await Promise.all(
      Array.from(orgIds).map((orgId) => this.organizationRepo.getById(orgId).then((org) =>
        org ? { id: org.id, name: org.name } : { id: orgId, name: orgId }
      )),
    );
    const orgs: OrganizationAccess[] = orgResults;
    const sorted = orgs.sort((a, b) => a.name.localeCompare(b.name));
    orgListCache.set(userId, { data: sorted, expiresAt: Date.now() + ORG_LIST_CACHE_TTL_MS });
    return sorted;
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
