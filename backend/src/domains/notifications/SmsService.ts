import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISmsProvider } from './ISmsProvider';
import { AwsSnsSmsProvider } from './providers/AwsSnsSmsProvider';
import { TwilioSmsProvider } from './providers/TwilioSmsProvider';
import { AfricasTalkingSmsProvider } from './providers/AfricasTalkingSmsProvider';

@Injectable()
export class SmsService {
  private readonly provider: ISmsProvider;
  private readonly enabled: boolean;
  private readonly senderId: string;

  constructor(
    @Optional() @Inject(ConfigService) config: ConfigService | null,
    awsProvider: AwsSnsSmsProvider,
    twilioProvider: TwilioSmsProvider,
    africastalkingProvider: AfricasTalkingSmsProvider,
  ) {
    this.enabled = config?.get<boolean>('sms.enabled') ?? process.env['SMS_ENABLED'] === 'true';
    this.senderId = config?.get<string>('sms.senderId') || process.env['SMS_SENDER_ID'] || 'Kaba';

    const providerName = config?.get<string>('sms.provider') || process.env['SMS_PROVIDER'] || 'aws_sns';
    switch (providerName) {
      case 'twilio':
        this.provider = twilioProvider;
        break;
      case 'africastalking':
        this.provider = africastalkingProvider;
        break;
      default:
        this.provider = awsProvider;
    }
  }

  /** Send SMS (OTP, receipts, etc.). When disabled, returns success without sending. */
  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.enabled) return { success: true };
    return this.provider.send(phone, message);
  }

  /** Send transaction receipt via SMS. */
  async sendTransactionReceipt(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    return this.send(phone, message);
  }

  /** Format receipt message for SMS. */
  formatReceiptMessage(
    type: 'sale' | 'expense',
    amount: number,
    currency: string,
    description?: string,
  ): string {
    const action = type === 'sale' ? 'Received' : 'Spent';
    const desc = description ? ` - ${description.slice(0, 30)}` : '';
    return `${this.senderId}: ${action} ${currency} ${amount.toLocaleString()}${desc}. Thank you.`;
  }
}
