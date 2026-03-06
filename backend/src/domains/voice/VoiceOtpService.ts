import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '@/domains/otp/OtpService';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';

export type VoiceLocale = 'en' | 'fr';

const OTP_MESSAGES: Record<VoiceLocale, (code: string) => string> = {
  en: (code) => `Your Kaba code is ${code.split('').join('-')}. Valid for 10 minutes.`,
  fr: (code) => `Votre code Kaba est ${code.split('').join('-')}. Valable 10 minutes.`,
};

@Injectable()
export class VoiceOtpService {
  private readonly voice: { call: (opts: { callFrom: string; callTo: string | string[]; clientRequestId?: string }) => Promise<unknown> } | null = null;
  private readonly voicePhone: string;

  constructor(
    @Optional() @Inject(ConfigService) config: ConfigService | null,
    private readonly otpService: OtpService,
    private readonly userRepo: UserRepository,
  ) {
    const username = config?.get<string>('sms.africastalking.username') || process.env['AFRICASTALKING_USERNAME'];
    const apiKey = config?.get<string>('sms.africastalking.apiKey') || process.env['AFRICASTALKING_API_KEY'];
    this.voicePhone = config?.get<string>('sms.africastalking.voicePhone') || process.env['AFRICASTALKING_VOICE_PHONE'] || '';

    if (username && apiKey) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AfricasTalking = require('africastalking')({ username, apiKey });
      this.voice = AfricasTalking.VOICE;
    }
  }

  /** Generate OTP message for TTS by locale. */
  getOtpMessage(code: string, locale: VoiceLocale = 'en'): string {
    return OTP_MESSAGES[locale](code);
  }

  /** Initiate outbound voice call to speak OTP. Requires Africa's Talking Voice phone and callback URL configured. */
  async initiateCall(phone: string, locale: VoiceLocale = 'en'): Promise<{ success: boolean; message: string }> {
    if (!this.voice || !this.voicePhone) {
      return { success: false, message: 'Voice OTP is not configured' };
    }

    const normalized = this.normalizePhone(phone);
    if (!normalized) {
      return { success: false, message: 'Invalid phone number' };
    }

    const user = await this.userRepo.getByPhone(phone);
    if (!user) {
      return {
        success: false,
        message: 'Account not found. Please contact your administrator to get access.',
      };
    }

    try {
      const code = await this.otpService.createAndStore(phone);
      const clientRequestId = `voice_otp_${normalized}_${Date.now()}`;

      await this.voice.call({
        callFrom: this.voicePhone,
        callTo: normalized,
        clientRequestId,
      });

      return {
        success: true,
        message: `Voice call initiated to ${phone}. You will receive a call with your code.`,
      };
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to initiate voice call',
      };
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
