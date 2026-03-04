import { Injectable, UnauthorizedException, ConflictException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository, getUserIdFromPhone } from './repositories/UserRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { TeamMemberRepository } from '@/domains/access/repositories/TeamMemberRepository';
import { OtpService } from '@/domains/otp/OtpService';
import { SmsService } from '@/domains/notifications/SmsService';
import { EmailVerificationRepository } from '@/domains/verification/EmailVerificationRepository';
import { EmailService } from '@/domains/verification/EmailService';
import type { User } from './entities/User.entity';

const SALT_ROUNDS = 10;

export interface AuthResult {
  accessToken: string;
  user: { id: string; phone?: string; email?: string; role?: string; emailVerified?: boolean; phoneVerified?: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
    private readonly userRepo: UserRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly emailVerificationRepo: EmailVerificationRepository,
    private readonly emailService: EmailService,
  ) {}

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    if (!phone?.trim()) {
      return { success: false, message: 'Phone is required' };
    }
    const code = await this.otpService.createAndStore(phone);
    const smsEnabled = this.config?.get<boolean>('sms.enabled') ?? process.env['SMS_ENABLED'] === 'true';
    if (smsEnabled) {
      const msg = `Your QuickBooks code is ${code}. Valid for 10 minutes.`;
      const result = await this.smsService.send(phone, msg);
      if (!result.success) {
        return { success: false, message: 'Failed to send OTP. Please try again.' };
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`[DEV] OTP for ${phone}: ${code}`);
    }
    return {
      success: true,
      message: smsEnabled ? `OTP sent to ${phone}` : `OTP sent. In dev mode, use ${code} to login.`,
    };
  }

  async loginWithPhone(phone: string, otp?: string): Promise<AuthResult> {
    if (!phone?.trim()) {
      throw new UnauthorizedException('Phone is required');
    }
    const valid = await this.otpService.verify(phone, otp ?? '');
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }
    const userId = getUserIdFromPhone(phone);
    let user = await this.userRepo.getById(userId);
    if (!user) {
      user = await this.createPhoneUser(phone);
    }
    await this.ensureDefaultBusiness(user.id);
    const role = user.role ?? this.resolveRole(undefined, phone);
    const payload = { sub: user.id, phone, role, phoneVerified: true };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: user.id, phone, phoneVerified: true, ...(role && { role }) },
    };
  }

  private async createPhoneUser(phone: string): Promise<User> {
    const userId = getUserIdFromPhone(phone);
    const existing = await this.userRepo.getByPhone(phone);
    if (existing) return existing;

    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      phone,
      provider: 'phone',
      role: this.resolveRole(undefined, phone) ?? 'user',
      phoneVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.userRepo.create(user);
    return user;
  }

  async signUpRequest(email: string): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const code = this.otpService.generateCode();
    const ttlMinutes = this.config?.get<number>('otp.ttlMinutes') ?? parseInt(process.env['OTP_TTL_MINUTES'] || '10', 10);
    await this.emailVerificationRepo.save(normalizedEmail, code, ttlMinutes);
    await this.emailService.sendVerificationCode(normalizedEmail, code);

    return {
      success: true,
      message: `Verification code sent to ${normalizedEmail}. Check your inbox.`,
    };
  }

  async signUpVerify(email: string, code: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const record = await this.emailVerificationRepo.getLatest(normalizedEmail);
    if (!record || record.code !== code) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }
    if (new Date(record.expiresAt) < new Date()) {
      throw new UnauthorizedException('Verification code has expired');
    }
    await this.emailVerificationRepo.delete(normalizedEmail);

    const existing = await this.userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const userId = `user_${uuidv4().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      email: normalizedEmail,
      provider: 'local',
      passwordHash,
      role: this.resolveRole(normalizedEmail) ? 'admin' : 'user',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepo.create(user);
    await this.ensureDefaultBusiness(userId);

    const payload = { sub: userId, email: normalizedEmail, role: user.role, emailVerified: true };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: userId, email: normalizedEmail, emailVerified: true, ...(user.role && { role: user.role }) },
    };
  }

  /** @deprecated Use signUpRequest + signUpVerify. Kept for backward compatibility. */
  async signUp(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const userId = `user_${uuidv4().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();
    const user: User = {
      id: userId,
      email: normalizedEmail,
      provider: 'local',
      passwordHash,
      role: this.resolveRole(normalizedEmail) ? 'admin' : 'user',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    await this.userRepo.create(user);
    await this.ensureDefaultBusiness(userId);

    const payload = { sub: userId, email: normalizedEmail, role: user.role, emailVerified: true };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: userId, email: normalizedEmail, emailVerified: true, ...(user.role && { role: user.role }) },
    };
  }

  async loginWithEmail(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.getByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.ensureDefaultBusiness(user.id);

    const role = user.role ?? (this.resolveRole(normalizedEmail) ? 'admin' : 'user');
    const emailVerified = user.emailVerified ?? true;
    const payload = { sub: user.id, email: user.email, role, emailVerified };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: user.id, email: user.email, emailVerified, ...(role && { role }) },
    };
  }

  async loginOrCreateOAuth(
    provider: 'google' | 'facebook',
    providerId: string,
    email?: string,
    name?: string,
  ): Promise<AuthResult> {
    const userId = `${provider}_${providerId}`;
    let user = await this.userRepo.getByProviderId(provider, providerId);

    if (!user) {
      const now = new Date().toISOString();
      user = {
        id: userId,
        email: email?.toLowerCase().trim(),
        provider,
        providerId,
        role: this.resolveRole(email) ? 'admin' : 'user',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      };
      await this.userRepo.create(user);
    }

    await this.ensureDefaultBusiness(user.id);

    const role = user.role ?? (this.resolveRole(user.email) ? 'admin' : 'user');
    const emailVerified = user.emailVerified ?? true;
    const payload = { sub: user.id, email: user.email, role, emailVerified };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: user.id, email: user.email, emailVerified, ...(role && { role }) },
    };
  }

  private async ensureDefaultBusiness(userId: string): Promise<void> {
    const businesses = await this.teamMemberRepo.listBusinessesForUser(userId);
    if (businesses.length > 0) return;

    const businessId = `biz_${uuidv4().slice(0, 8)}`;
    await this.businessRepo.getOrCreate(businessId);
    await this.teamMemberRepo.addBusinessMember({
      userId,
      businessId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    });
  }

  private resolveRole(email?: string, phone?: string): 'admin' | null {
    const adminEmails = this.config?.get<string[]>('admin.emails') ?? (process.env['ADMIN_EMAILS'] ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const adminPhones = this.config?.get<string[]>('admin.phones') ?? (process.env['ADMIN_PHONES'] ?? '').split(',').map((p) => p.trim()).filter(Boolean);

    if (email && adminEmails.includes(email.toLowerCase())) return 'admin';
    if (phone) {
      const normalized = phone.replace(/\D/g, '');
      if (adminPhones.some((p) => p.replace(/\D/g, '') === normalized)) return 'admin';
    }
    return null;
  }
}
