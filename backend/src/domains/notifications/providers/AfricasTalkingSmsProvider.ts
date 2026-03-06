import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from '../ISmsProvider';

@Injectable()
export class AfricasTalkingSmsProvider implements ISmsProvider {
  private readonly sms: { send: (opts: { to: string[]; message: string; senderId?: string }) => Promise<{ SMSMessageData: { Recipients: { status: string; messageId?: string }[] } }> } | null = null;
  private readonly senderId: string;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const username = config?.get<string>('sms.africastalking.username') || process.env['AFRICASTALKING_USERNAME'];
    const apiKey = config?.get<string>('sms.africastalking.apiKey') || process.env['AFRICASTALKING_API_KEY'];
    this.senderId = config?.get<string>('sms.africastalking.senderId') || process.env['AFRICASTALKING_SENDER_ID'] || process.env['SMS_SENDER_ID'] || 'Kaba';

    if (username && apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AfricasTalking = require('africastalking')({ username, apiKey });
      this.sms = AfricasTalking.SMS;
    }
  }

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.sms) return { success: false };

    const normalized = this.normalizePhone(phone);
    if (!normalized) return { success: false };

    try {
      const response = await this.sms.send({
        to: [normalized],
        message,
        senderId: this.senderId.slice(0, 11),
      });
      const recipient = response?.SMSMessageData?.Recipients?.[0];
      const ok = recipient?.status === 'Success';
      return { success: ok, messageId: recipient?.messageId };
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
