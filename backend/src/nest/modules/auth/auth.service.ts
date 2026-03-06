import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository, getUserIdFromPhone } from './repositories/UserRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { TeamMemberRepository } from '@/domains/access/repositories/TeamMemberRepository';
import { InvitationService } from '@/domains/access/InvitationService';
import { OtpService } from '@/domains/otp/OtpService';
import { SmsService } from '@/domains/notifications/SmsService';
import { EmailVerificationRepository } from '@/domains/verification/EmailVerificationRepository';
import { EmailService } from '@/domains/verification/EmailService';
import { PasswordResetRepository } from '@/domains/verification/PasswordResetRepository';
import type { User } from './entities/User.entity';
import { IAuditLogger } from '@/domains/audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '@/domains/audit/AuditModule';
import type { AuditAction } from '@/domains/audit/models/AuditLog';

const SALT_ROUNDS = 10;

function isEmail(s: string): boolean {
  return s.includes('@');
}

export interface AuthResult {
  accessToken: string;
  user: { id: string; phone?: string; email?: string; name?: string; picture?: string; role?: string; emailVerified?: boolean; phoneVerified?: boolean };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Optional() @Inject(ConfigService) private readonly config: ConfigService | null,
    private readonly userRepo: UserRepository,
    private readonly businessRepo: BusinessRepository,
    private readonly teamMemberRepo: TeamMemberRepository,
    private readonly invitationService: InvitationService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly emailVerificationRepo: EmailVerificationRepository,
    private readonly emailService: EmailService,
    private readonly passwordResetRepo: PasswordResetRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  /**
   * Hash PII (email / phone) before storing in the audit log so raw credentials
   * are never persisted for the 7-year retention window.
   * Uses SHA-256 — one-way, deterministic, safe for audit correlation.
   */
  private hashIdentifier(value: string): string {
    return `hashed:${createHash('sha256').update(value.toLowerCase().trim()).digest('hex').slice(0, 16)}`;
  }

  private async auditAuth(
    action: AuditAction,
    entityId: string,
    metadata?: Record<string, unknown>,
    isPii = false,
  ): Promise<void> {
    if (!this.auditLogger) return;
    // For failed-login events, entityId may be a raw email/phone — hash it.
    const safeEntityId = isPii ? this.hashIdentifier(entityId) : entityId;
    this.auditLogger.log({
      entityType: 'auth',
      entityId: safeEntityId,
      businessId: 'SYSTEM',
      action,
      userId: safeEntityId,
      ...(metadata && { metadata }),
    }).catch((err) => {
      console.error('[AuthService] Audit log failed:', err);
    });
  }

  async sendOtp(phone: string): Promise<{ success: boolean; message: string }> {
    if (!phone?.trim()) {
      return { success: false, message: 'Phone is required' };
    }
    const code = await this.otpService.createAndStore(phone);
    const smsEnabled = this.config?.get<boolean>('sms.enabled') ?? process.env['SMS_ENABLED'] === 'true';
    if (smsEnabled) {
      const msg = `Your Kaba code is ${code}. Valid for 10 minutes.`;
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

  async loginWithPhone(phone: string, otp?: string, password?: string): Promise<AuthResult> {
    if (!phone?.trim()) {
      throw new UnauthorizedException('Phone is required');
    }
    let user = await this.userRepo.getByPhone(phone);
    if (user?.passwordHash && password) {
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        await this.auditAuth('login.failed', phone, { reason: 'invalid_password', method: 'phone' }, true);
        throw new UnauthorizedException('Invalid phone or password');
      }
    } else {
      const valid = await this.otpService.verify(phone, otp ?? '');
      if (!valid) {
        await this.auditAuth('login.failed', phone, { reason: 'invalid_otp', method: 'phone' }, true);
        throw new UnauthorizedException('Invalid or expired OTP');
      }
      const userId = getUserIdFromPhone(phone);
      user = await this.userRepo.getById(userId);
      if (!user) {
        user = await this.createPhoneUser(phone);
      }
    }
    if (!user) throw new UnauthorizedException('Invalid credentials');
    await this.ensureDefaultBusiness(user.id);
    const role = user.role ?? this.resolveRole(undefined, phone);
    const payload = { sub: user.id, phone, role, phoneVerified: true };
    const accessToken = this.jwtService.sign(payload);
    await this.auditAuth('login', user.id, { method: 'phone' });
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

    await this.auditAuth('register', userId, { method: 'email' });

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

    await this.auditAuth('register', userId, { method: 'email_legacy' });

    const payload = { sub: userId, email: normalizedEmail, role: user.role, emailVerified: true };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: userId, email: normalizedEmail, emailVerified: true, ...(user.role && { role: user.role }) },
    };
  }

  /**
   * Invite activation: request OTP for email or phone. Validates token first.
   */
  async inviteRequestOtp(token: string): Promise<{ success: boolean; message: string }> {
    const data = await this.invitationService.getByToken(token);
    if (!data) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    const { emailOrPhone } = data;

    if (isEmail(emailOrPhone)) {
      const normalizedEmail = emailOrPhone.toLowerCase().trim();
      const existing = await this.userRepo.getByEmail(normalizedEmail);
      if (existing) {
        throw new ConflictException('An account with this email already exists. Please sign in and accept the invitation.');
      }
      const code = this.otpService.generateCode();
      const ttlMinutes = this.config?.get<number>('otp.ttlMinutes') ?? parseInt(process.env['OTP_TTL_MINUTES'] || '10', 10);
      await this.emailVerificationRepo.save(normalizedEmail, code, ttlMinutes);
      await this.emailService.sendVerificationCode(normalizedEmail, code);
      return { success: true, message: `Verification code sent to ${normalizedEmail}` };
    } else {
      const phone = emailOrPhone.trim();
      const existing = await this.userRepo.getByPhone(phone);
      if (existing) {
        throw new ConflictException('An account with this phone already exists. Please sign in and accept the invitation.');
      }
      return this.sendOtp(phone);
    }
  }

  /**
   * Invite activation: verify OTP, create user with password, accept invitation, return JWT.
   */
  async inviteVerify(input: { token: string; emailOrPhone: string; code: string; password: string }): Promise<AuthResult> {
    const { token, emailOrPhone, code, password } = input;
    if (!token?.trim() || !emailOrPhone?.trim() || !code?.trim() || !password?.trim()) {
      throw new BadRequestException('token, emailOrPhone, code, and password are required');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const inviteData = await this.invitationService.getByToken(token);
    if (!inviteData) {
      throw new BadRequestException('Invalid or expired invitation');
    }
    if (inviteData.emailOrPhone.toLowerCase().trim() !== emailOrPhone.toLowerCase().trim()) {
      throw new BadRequestException('Email or phone does not match invitation');
    }

    let userId: string;
    const normalized = emailOrPhone.trim().toLowerCase();

    if (isEmail(emailOrPhone)) {
      const record = await this.emailVerificationRepo.getLatest(normalized);
      if (!record || record.code !== code) {
        throw new UnauthorizedException('Invalid or expired verification code');
      }
      if (new Date(record.expiresAt) < new Date()) {
        throw new UnauthorizedException('Verification code has expired');
      }
      await this.emailVerificationRepo.delete(normalized);

      const existing = await this.userRepo.getByEmail(normalized);
      if (existing) {
        throw new ConflictException('An account with this email already exists');
      }

      userId = `user_${uuidv4().slice(0, 8)}`;
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const now = new Date().toISOString();
      const user: User = {
        id: userId,
        email: normalized,
        provider: 'local',
        passwordHash,
        role: this.resolveRole(normalized) ? 'admin' : 'user',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      };
      await this.userRepo.create(user);
    } else {
      const valid = await this.otpService.verify(emailOrPhone.trim(), code);
      if (!valid) {
        throw new UnauthorizedException('Invalid or expired verification code');
      }

      const existing = await this.userRepo.getByPhone(emailOrPhone.trim());
      if (existing) {
        throw new ConflictException('An account with this phone already exists');
      }

      userId = getUserIdFromPhone(emailOrPhone.trim());
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const now = new Date().toISOString();
      const user: User = {
        id: userId,
        phone: emailOrPhone.trim(),
        provider: 'phone',
        passwordHash,
        role: this.resolveRole(undefined, emailOrPhone) ? 'admin' : 'user',
        phoneVerified: true,
        createdAt: now,
        updatedAt: now,
      };
      await this.userRepo.create(user);
    }

    await this.invitationService.accept({ token, userId });

    const user = await this.userRepo.getById(userId);
    if (!user) throw new UnauthorizedException('User creation failed');

    await this.auditAuth('register', userId, { method: 'invite' });

    const payload = user.email
      ? { sub: user.id, email: user.email, role: user.role, emailVerified: true }
      : { sub: user.id, phone: user.phone, role: user.role, phoneVerified: true };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        ...(user.role && { role: user.role }),
      },
    };
  }

  /** Request password reset. Works for both email signup and OAuth users (Google/Facebook). */
  async forgotPasswordRequest(email: string): Promise<{ success: boolean; message: string }> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.userRepo.getByEmail(normalized);
    if (!user) {
      // Don't reveal whether the email exists - same response for security
      return {
        success: true,
        message: 'If an account exists with that email, you will receive a password reset link shortly.',
      };
    }

    const token = randomBytes(32).toString('hex');
    await this.passwordResetRepo.save(token, normalized);

    const frontendUrl = this.config?.get<string>('oauth.frontendUrl') || process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;
    await this.emailService.sendPasswordResetLink(normalized, resetLink);

    return {
      success: true,
      message: 'If an account exists with that email, you will receive a password reset link shortly.',
    };
  }

  /** Reset password using token from email link. Enables email/password login for OAuth users. */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!token?.trim() || !newPassword?.trim()) {
      throw new BadRequestException('Token and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const record = await this.passwordResetRepo.get(token.trim());
    if (!record) {
      throw new UnauthorizedException('Invalid or expired reset link. Please request a new one.');
    }
    if (new Date(record.expiresAt) < new Date()) {
      await this.passwordResetRepo.delete(token.trim());
      throw new UnauthorizedException('Reset link has expired. Please request a new one.');
    }

    const user = await this.userRepo.getByEmail(record.email);
    if (!user) {
      await this.passwordResetRepo.delete(token.trim());
      throw new UnauthorizedException('User not found.');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated: User = {
      ...user,
      passwordHash,
      updatedAt: new Date().toISOString(),
    };
    await this.userRepo.update(updated);
    await this.passwordResetRepo.delete(token.trim());

    await this.auditAuth('password.reset', user.id, { email: record.email });

    return {
      success: true,
      message: 'Password has been reset. You can now sign in with your email and password.',
    };
  }

  async loginWithEmail(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.getByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      await this.auditAuth('login.failed', normalizedEmail, { reason: 'user_not_found', method: 'email' }, true);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await this.auditAuth('login.failed', user.id, { reason: 'invalid_password', method: 'email' });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.ensureDefaultBusiness(user.id);

    const role = user.role ?? (this.resolveRole(normalizedEmail) ? 'admin' : 'user');
    const emailVerified = user.emailVerified ?? true;
    const payload = { sub: user.id, email: user.email, role, emailVerified };
    const accessToken = this.jwtService.sign(payload);
    await this.auditAuth('login', user.id, { method: 'email' });
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
    picture?: string,
  ): Promise<AuthResult> {
    const userId = `${provider}_${providerId}`;
    let user = await this.userRepo.getByProviderId(provider, providerId);
    const isNewUser = !user;

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

    if (isNewUser) {
      await this.auditAuth('register', user.id, { method: provider });
    } else {
      await this.auditAuth('login', user.id, { method: provider });
    }

    const role = user.role ?? (this.resolveRole(user.email) ? 'admin' : 'user');
    const emailVerified = user.emailVerified ?? true;
    const payload = { sub: user.id, email: user.email, role, emailVerified, name: name ?? undefined, picture: picture ?? undefined };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: { id: user.id, email: user.email, name: name ?? undefined, picture: picture ?? undefined, emailVerified, ...(role && { role }) },
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
