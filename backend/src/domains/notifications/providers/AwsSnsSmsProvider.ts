import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ISmsProvider } from '../ISmsProvider';

@Injectable()
export class AwsSnsSmsProvider implements ISmsProvider {
  private readonly sns: SNSClient;
  private readonly senderId: string;

  constructor(@Optional() @Inject(ConfigService) config: ConfigService | null) {
    const region =
      config?.get<string>('sms.aws.region') ||
      config?.get<string>('region') ||
      process.env['AWS_REGION'] ||
      'ca-central-1';
    this.sns = new SNSClient({ region });
    this.senderId =
      config?.get<string>('sms.senderId') || process.env['SMS_SENDER_ID'] || 'Kaba';
  }

  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return { success: false };

    try {
      const result = await this.sns.send(
        new PublishCommand({
          Message: message,
          PhoneNumber: normalized,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: this.senderId.slice(0, 11),
            },
          },
        }),
      );
      return { success: true, messageId: result.MessageId };
    } catch {
      return { success: false };
    }
  }

  private normalizePhone(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return null;
    // Nigeria: 0 + 10 digits -> +234
    if (digits.startsWith('0') && digits.length >= 11) return `+234${digits.slice(1)}`;
    // North America: 10 digits or 1 + 10 digits -> +1
    if (digits.length === 10 && digits[0] >= '2' && digits[0] <= '9') return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (!phone.startsWith('+')) return `+${digits}`;
    return phone;
  }
}
