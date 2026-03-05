import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly enabled: boolean;

  constructor(
    @Optional() @Inject(ConfigService) config: ConfigService | null,
  ) {
    this.enabled = config?.get<boolean>('email.enabled') ?? process.env['EMAIL_ENABLED'] === 'true';
  }

  /** Send verification email. When disabled (dev), logs to console. */
  async sendVerificationCode(email: string, code: string): Promise<{ success: boolean }> {
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Email verification code for ${email}: ${code}`);
      return { success: true };
    }
    // TODO: Integrate nodemailer, SendGrid, or AWS SES for production
    // eslint-disable-next-line no-console
    console.log(`[DEV] Email verification code for ${email}: ${code}`);
    return { success: true };
  }

  /** Send invitation email with link. When disabled (dev), logs to console. */
  async sendInvitation(
    email: string,
    inviteLink: string,
    businessName: string,
    role: string,
  ): Promise<{ success: boolean }> {
    const subject = `You're invited to join ${businessName}`;
    const body = `You've been invited to join ${businessName} as ${role}. Click the link below to accept:\n\n${inviteLink}\n\nThis link expires in 7 days.`;
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Invitation email to ${email}: ${inviteLink}`);
      return { success: true };
    }
    // TODO: Integrate nodemailer, SendGrid, or AWS SES for production
    // eslint-disable-next-line no-console
    console.log(`[DEV] Invitation email to ${email}: ${inviteLink}`);
    return { success: true };
  }
}
