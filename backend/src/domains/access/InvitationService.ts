import { Injectable, BadRequestException } from '@nestjs/common';
import { InvitationRepository } from './repositories/InvitationRepository';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { NotFoundError } from '@/shared/errors/DomainError';
import type { Invitation } from './models/Invitation';
import type { Role } from './role.types';

@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly businessRepo: BusinessRepository,
  ) {}

  async create(input: {
    emailOrPhone: string;
    businessId: string;
    role: Role;
    invitedBy: string;
    expiresInHours?: number;
  }): Promise<Invitation> {
    const business = await this.businessRepo.getById(input.businessId);
    if (!business) {
      throw new NotFoundError('Business', input.businessId);
    }
    return this.invitationRepo.create({
      emailOrPhone: input.emailOrPhone,
      businessId: input.businessId,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresInHours: input.expiresInHours ?? 168,
    });
  }

  async accept(input: { token: string; userId: string }): Promise<{ success: boolean }> {
    const invitation = await this.invitationRepo.getByToken(input.token);
    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      await this.invitationRepo.delete(invitation);
      throw new BadRequestException('Invitation has expired');
    }

    await this.teamMemberRepo.addBusinessMember({
      userId: input.userId,
      businessId: invitation.businessId,
      role: invitation.role,
      createdAt: new Date().toISOString(),
    });
    await this.invitationRepo.delete(invitation);
    return { success: true };
  }

  async listByBusiness(businessId: string): Promise<Invitation[]> {
    return this.invitationRepo.listByBusiness(businessId);
  }
}
