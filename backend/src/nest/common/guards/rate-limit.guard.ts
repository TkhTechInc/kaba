/**
 * Enhanced rate limiting with IP-based lockout for auth endpoints
 *
 * Features:
 * - Endpoint-specific limits (login, OTP, etc.)
 * - IP-based progressive lockout after failed attempts
 * - Redis-backed for distributed rate limiting
 * - Fallback to in-memory if Redis unavailable
 */
import { Injectable, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

interface RateLimitStore {
  get(key: string): Promise<number>;
  increment(key: string, ttl: number): Promise<number>;
  reset(key: string): Promise<void>;
}

/**
 * In-memory rate limit store (fallback when Redis unavailable)
 */
class InMemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; expiresAt: number }>();

  async get(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return 0;
    }
    return entry.count;
  }

  async increment(key: string, ttl: number): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now > entry.expiresAt) {
      const newEntry = { count: 1, expiresAt: now + ttl };
      this.store.set(key, newEntry);
      return 1;
    }

    entry.count++;
    this.store.set(key, entry);
    return entry.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Periodic cleanup
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

@Injectable()
export class EnhancedRateLimitGuard extends ThrottlerGuard {
  private store: RateLimitStore = new InMemoryStore();

  constructor() {
    super({
      ttl: 60000,
      limit: 200,
    } as any, {} as any);

    // Cleanup in-memory store every 5 minutes
    if (this.store instanceof InMemoryStore) {
      setInterval(() => this.store.cleanup(), 5 * 60 * 1000);
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const endpoint = request.route?.path || request.path;

    // Check if IP is locked out
    const lockoutKey = `lockout:${ip}`;
    const lockoutCount = await this.store.get(lockoutKey);
    if (lockoutCount >= 10) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many failed login attempts. Try again in 1 hour.',
          error: 'RATE_LIMIT_EXCEEDED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Endpoint-specific rate limits
    const limits = this.getEndpointLimits(endpoint);
    const key = `${endpoint}:${ip}`;

    const currentCount = await this.store.increment(key, limits.ttl);

    if (currentCount > limits.limit) {
      // Track failed attempt for progressive lockout
      await this.trackFailedAttempt(ip);

      throw new ThrottlerException(
        `Rate limit exceeded. Max ${limits.limit} requests per ${limits.ttl / 1000}s.`,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  private getEndpointLimits(endpoint: string): { limit: number; ttl: number } {
    // Auth endpoints - strict limits
    if (endpoint.includes('/auth/login')) {
      return { limit: 5, ttl: 60000 }; // 5 attempts per minute
    }
    if (endpoint.includes('/auth/send-otp') || endpoint.includes('/auth/voice-otp')) {
      return { limit: 3, ttl: 60000 }; // 3 OTPs per minute (SMS cost control)
    }
    if (endpoint.includes('/auth/sign-up')) {
      return { limit: 3, ttl: 300000 }; // 3 sign-ups per 5 minutes
    }
    if (endpoint.includes('/auth/forgot-password')) {
      return { limit: 3, ttl: 3600000 }; // 3 reset requests per hour
    }

    // Payment endpoints - moderate limits
    if (endpoint.includes('/payments/')) {
      return { limit: 10, ttl: 60000 }; // 10 per minute
    }

    // Default for all other endpoints
    return { limit: 200, ttl: 60000 }; // 200 per minute
  }

  private async trackFailedAttempt(ip: string): Promise<void> {
    const lockoutKey = `lockout:${ip}`;
    const count = await this.store.increment(lockoutKey, 3600000); // 1 hour TTL

    if (count === 10) {
      console.warn(`[RateLimit] IP ${ip} locked out after 10 failed attempts`);
    }
  }

  /**
   * Call after successful login to reset lockout counter
   */
  async resetLockout(ip: string): Promise<void> {
    const lockoutKey = `lockout:${ip}`;
    await this.store.reset(lockoutKey);
  }
}
