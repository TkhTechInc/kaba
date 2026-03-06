import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendRawEmailCommand,
  type SendRawEmailCommandInput,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly enabled: boolean;
  private readonly sesRegion: string | undefined;
  private readonly fromEmail: string;
  private sesClient: SESClient | null = null;

  constructor(
    @Optional() @Inject(ConfigService) config: ConfigService | null,
  ) {
    this.enabled = config?.get<boolean>('email.enabled') ?? process.env['EMAIL_ENABLED'] === 'true';
    this.sesRegion =
      config?.get<string>('aws.sesRegion') ??
      process.env['AWS_SES_REGION'] ??
      process.env['AWS_REGION'];
    this.fromEmail =
      config?.get<string>('email.from') ??
      process.env['EMAIL_FROM'] ??
      process.env['AWS_SES_FROM'] ??
      'noreply@example.com';
  }

  private getSesClient(): SESClient {
    if (!this.sesClient) {
      this.sesClient = new SESClient({ region: this.sesRegion });
    }
    return this.sesClient;
  }

  /** Send verification email. When disabled (dev), logs to console. */
  async sendVerificationCode(email: string, code: string): Promise<{ success: boolean }> {
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Email verification code for ${email}: ${code}`);
      return { success: true };
    }
    if (this.sesRegion) {
      try {
        const input: SendEmailCommandInput = {
          Source: this.fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: 'Your QuickBooks verification code' },
            Body: {
              Text: {
                Data: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
              },
            },
          },
        };
        await this.getSesClient().send(new SendEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendVerificationCode failed:', err);
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Email verification code for ${email}: ${code}`);
    return { success: true };
  }

  /** Send password reset link. When disabled (dev), logs to console. */
  async sendPasswordResetLink(email: string, resetLink: string): Promise<{ success: boolean }> {
    const subject = 'Reset your QuickBooks password';
    const body = `You requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`;
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Password reset link for ${email}: ${resetLink}`);
      return { success: true };
    }
    if (this.sesRegion) {
      try {
        const input: SendEmailCommandInput = {
          Source: this.fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        };
        await this.getSesClient().send(new SendEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendPasswordResetLink failed:', err);
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Password reset link for ${email}: ${resetLink}`);
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
    if (this.sesRegion) {
      try {
        const input: SendEmailCommandInput = {
          Source: this.fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        };
        await this.getSesClient().send(new SendEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendInvitation failed:', err);
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Invitation email to ${email}: ${inviteLink}`);
    return { success: true };
  }

  /**
   * Send invoice email with optional PDF attachment.
   * When disabled: logs to console and returns { success: true }.
   * When enabled and AWS_SES_REGION is set: uses SES SendRawEmailCommand.
   * Otherwise: logs to console.
   */
  async sendInvoice(
    toEmail: string,
    subject: string,
    body: string,
    pdfBuffer?: Buffer,
    invoiceId?: string,
  ): Promise<{ success: boolean }> {
    const filename = pdfBuffer && invoiceId ? `invoice-${invoiceId}.pdf` : 'invoice.pdf';
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Invoice email to ${toEmail}: ${subject}${pdfBuffer ? ` (with ${filename})` : ''}`);
      return { success: true };
    }
    if (this.sesRegion) {
      try {
        const rawMessage = this.buildRawMessage(toEmail, subject, body, pdfBuffer, filename);
        const input: SendRawEmailCommandInput = {
          RawMessage: { Data: rawMessage },
        };
        await this.getSesClient().send(new SendRawEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendInvoice failed:', err);
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Invoice email to ${toEmail}: ${subject}${pdfBuffer ? ` (with ${filename})` : ''}`);
    return { success: true };
  }

  private buildRawMessage(
    toEmail: string,
    subject: string,
    body: string,
    pdfBuffer?: Buffer,
    filename?: string,
  ): Uint8Array {
    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const lines: string[] = [
      `MIME-Version: 1.0`,
      `From: ${this.fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      body,
      ``,
    ];
    if (pdfBuffer && filename) {
      lines.push(
        `--${boundary}`,
        `Content-Type: application/pdf; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        (pdfBuffer.toString('base64').match(/.{1,76}/g) ?? []).join('\r\n'),
        ``,
      );
    }
    lines.push(`--${boundary}--`);
    return new TextEncoder().encode(lines.join('\r\n'));
  }
}
