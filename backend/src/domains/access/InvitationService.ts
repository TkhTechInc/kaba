import { Injectable, BadRequestException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationRepository } from './repositories/InvitationRepository';
import { TeamMemberRepository } from './repositories/TeamMemberRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { EmailService } from '@/domains/verification/EmailService';
import { SmsService } from '@/domains/notifications/SmsService';
import { NotFoundError } from '@/shared/errors/DomainError';
import type { Invitation } from './models/Invitation';
import type { Role } from './role.types';

function isEmail(s: string): boolean {
  return s.includes('@');
}

@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepo: InvitationRepository,
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
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
    const invitation = await this.invitationRepo.create({
      emailOrPhone: input.emailOrPhone,
      businessId: input.businessId,
      role: input.role,
      invitedBy: input.invitedBy,
      expiresInHours: input.expiresInHours ?? 168,
    });

    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') ?? process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/invite?token=${invitation.token}`;
    const businessName = business.name ?? 'a business';
    const roleLabel = input.role.charAt(0).toUpperCase() + input.role.slice(1);

    if (isEmail(input.emailOrPhone)) {
      await this.emailService.sendInvitation(
        input.emailOrPhone.trim().toLowerCase(),
        inviteLink,
        businessName,
        roleLabel,
      );
    } else {
      const smsEnabled = this.config?.get<boolean>('sms.enabled') ?? process.env['SMS_ENABLED'] === 'true';
      const msg = `You're invited to join ${businessName} as ${roleLabel}. Accept: ${inviteLink}`;
      if (smsEnabled) {
        await this.smsService.send(input.emailOrPhone.trim(), msg);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[DEV] Invitation SMS to ${input.emailOrPhone}: ${inviteLink}`);
      }
    }

    return invitation;
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

  /**
   * Get invitation by token (public). Returns safe data for invitee activation.
   */
  async getByToken(token: string): Promise<{ emailOrPhone: string; businessName: string; role: Role } | null> {
    if (!token?.trim()) return null;
    const invitation = await this.invitationRepo.getByToken(token.trim());
    if (!invitation) return null;
    if (new Date(invitation.expiresAt) < new Date()) return null;

    const business = await this.businessRepo.getById(invitation.businessId);
    return {
      emailOrPhone: invitation.emailOrPhone,
      businessName: business?.name ?? 'a business',
      role: invitation.role,
    };
  }
}
