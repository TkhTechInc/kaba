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
    // For now, dev mode logs to console
    // eslint-disable-next-line no-console
    console.log(`[DEV] Email verification code for ${email}: ${code}`);
    return { success: true };
  }
}
