import { Injectable, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpRepository } from './OtpRepository';

@Injectable()
export class OtpService {
  constructor(
    private readonly otpRepo: OtpRepository,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
  ) {}

  generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  async createAndStore(phone: string): Promise<string> {
    const code = this.generateCode();
    const ttlMinutes = this.config?.get<number>('otp.ttlMinutes') ?? parseInt(process.env['OTP_TTL_MINUTES'] || '10', 10);
    await this.otpRepo.save(phone, code, ttlMinutes);
    return code;
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const record = await this.otpRepo.getLatest(phone);
    if (!record) return false;
    if (record.code !== code) return false;
    if (new Date(record.expiresAt) < new Date()) return false;
    return true;
  }
}
