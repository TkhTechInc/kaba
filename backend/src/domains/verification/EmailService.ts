import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  SendRawEmailCommand,
  type SendRawEmailCommandInput,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import {
  type EmailLocale,
  parseEmailLocale,
  getEmailTemplates,
  buildHtmlEmail,
  textToHtml,
} from './email-templates';

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
  async sendVerificationCode(
    email: string,
    code: string,
    localeOrAcceptLanguage?: EmailLocale | string,
  ): Promise<{ success: boolean; devCode?: string }> {
    const locale = typeof localeOrAcceptLanguage === 'string' ? parseEmailLocale(localeOrAcceptLanguage) : (localeOrAcceptLanguage ?? 'en');
    const t = getEmailTemplates(locale);
    const expiresMinutes = 10;
    const subject = t.verification.subject;
    const body = t.verification.body(code, expiresMinutes);
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
            Subject: { Data: subject },
            Body: { Text: { Data: body } },
          },
        };
        await this.getSesClient().send(new SendEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendVerificationCode failed:', err);
        const isDev = process.env['NODE_ENV'] !== 'production';
        const isSandboxReject =
          err instanceof Error &&
          (err.name === 'MessageRejected' ||
            err.message?.includes('Email address is not verified') ||
            err.message?.includes('identities failed the check'));
        if (isDev && isSandboxReject) {
          // SES sandbox: recipient must be verified. Return code so dev can complete sign-up.
          return { success: true, devCode: code };
        }
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Email verification code for ${email}: ${code}`);
    return { success: true };
  }

  /** Send password reset link. When disabled (dev), logs to console. */
  async sendPasswordResetLink(
    email: string,
    resetLink: string,
    localeOrAcceptLanguage?: EmailLocale | string,
  ): Promise<{ success: boolean }> {
    const locale = typeof localeOrAcceptLanguage === 'string' ? parseEmailLocale(localeOrAcceptLanguage) : (localeOrAcceptLanguage ?? 'en');
    const t = getEmailTemplates(locale);
    const expiresMinutes = 60;
    const subject = t.passwordReset.subject;
    const body = t.passwordReset.body(resetLink, expiresMinutes);
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
    localeOrAcceptLanguage?: EmailLocale | string,
  ): Promise<{ success: boolean }> {
    const locale = typeof localeOrAcceptLanguage === 'string' ? parseEmailLocale(localeOrAcceptLanguage) : (localeOrAcceptLanguage ?? 'en');
    const t = getEmailTemplates(locale);
    const expiresDays = 7;
    const subject = t.invitation.subject(businessName);
    const body = t.invitation.body(businessName, role, inviteLink, expiresDays);
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
   * Send welcome email after account creation (HTML + text).
   * When disabled (dev), logs to console.
   */
  async sendWelcome(
    email: string,
    options: { userName?: string; dashboardUrl: string },
    localeOrAcceptLanguage?: EmailLocale | string,
  ): Promise<{ success: boolean }> {
    const locale = typeof localeOrAcceptLanguage === 'string' ? parseEmailLocale(localeOrAcceptLanguage) : (localeOrAcceptLanguage ?? 'en');
    const t = getEmailTemplates(locale);
    const subject = t.welcome.subject;
    const greeting = t.welcome.greeting(options.userName);
    const bodyHtml = textToHtml(t.welcome.body);
    const html = buildHtmlEmail({
      preheader: t.welcome.body.slice(0, 100),
      title: t.welcome.subject,
      greeting,
      bodyHtml,
      ctaUrl: options.dashboardUrl,
      ctaText: t.welcome.cta,
      footer: t.welcome.footer,
    });
    const textBody = `${greeting}\n\n${t.welcome.body}\n\n${t.welcome.cta}: ${options.dashboardUrl}\n\n— ${t.welcome.footer}`;
    if (!this.enabled) {
      // eslint-disable-next-line no-console
      console.log(`[DEV] Welcome email to ${email}: ${options.dashboardUrl}`);
      return { success: true };
    }
    if (this.sesRegion) {
      try {
        const input: SendEmailCommandInput = {
          Source: this.fromEmail,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: {
              Text: { Data: textBody },
              Html: { Data: html },
            },
          },
        };
        await this.getSesClient().send(new SendEmailCommand(input));
        return { success: true };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[EmailService] SES sendWelcome failed:', err);
        return { success: false };
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[DEV] Welcome email to ${email}: ${options.dashboardUrl}`);
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
