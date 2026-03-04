import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../ISmsProvider';

@Injectable()
export class TwilioSmsProvider implements ISmsProvider {
  private readonly client: import('twilio').Twilio | null = null;
  private readonly fromNumber: string;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const accountSid = config?.get<string>('sms.twilio.accountSid') || process.env['TWILIO_ACCOUNT_SID'];
    const authToken = config?.get<string>('sms.twilio.authToken') || process.env['TWILIO_AUTH_TOKEN'];
    this.fromNumber = config?.get<string>('sms.twilio.phoneNumber') || process.env['TWILIO_PHONE_NUMBER'] || '';

    if (accountSid && authToken) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio');
      this.client = twilio(accountSid, authToken) as import('twilio').Twilio;
    }
  }

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.client || !this.fromNumber) return { success: false };

    const normalized = this.normalizePhone(phone);
    if (!normalized) return { success: false };

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: normalized,
      });
      return { success: true, messageId: result.sid };
    } catch {
      return { success: false };
    }
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('0')) return `+234${digits.slice(1)}`;
    if (!phone.startsWith('+')) return `+${digits}`;
    return phone;
  }
}
