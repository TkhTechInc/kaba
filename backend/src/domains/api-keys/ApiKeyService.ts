import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { randomBytes } from 'crypto';
import { ApiKeyRepository } from './repositories/ApiKeyRepository';
import {
  ApiKey,
  CreateApiKeyInput,
  ApiKeyScope,
} from './models/ApiKey';
import { NotFoundError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../audit/AuditModule';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private generateKey(isTest: boolean): { raw: string; hash: string; prefix: string } {
    const prefix = isTest ? 'qb_test_' : 'qb_live_';
    const randomPart = randomBytes(32).toString('base64url').slice(0, 32);
    const raw = `${prefix}${randomPart}`;
    return {
      raw,
      hash: this.hashKey(raw),
      prefix: raw.slice(0, 12),
    };
  }

  async create(input: CreateApiKeyInput, userId?: string): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const { raw, hash, prefix } = this.generateKey(input.isTest ?? false);

    const apiKey = await this.apiKeyRepository.create(input, hash, prefix);

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'ApiKey',
        entityId: apiKey.id,
        businessId: apiKey.businessId,
        action: 'create',
        userId,
        changes: { name: { to: apiKey.name }, isTest: { to: input.isTest ?? false } },
      });
    }

    return {
      apiKey: {
        ...apiKey,
        keyHash: '***',
      },
      rawKey: raw,
    };
  }

  async revoke(businessId: string, id: string, userId?: string): Promise<void> {
    const existing = await this.apiKeyRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('API key', id);
    }
    await this.apiKeyRepository.delete(businessId, id);

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'ApiKey',
        entityId: id,
        businessId,
        action: 'revoke',
        userId,
        changes: { name: { from: existing.name, to: null } },
      });
    }
  }

  async list(businessId: string): Promise<ApiKey[]> {
    const keys = await this.apiKeyRepository.listByBusiness(businessId);
    return keys.map((k) => ({ ...k, keyHash: '***' }));
  }

  async validate(key: string): Promise<{ businessId: string; scopes: ApiKeyScope[]; keyId: string } | null> {
    if (!key?.trim() || (!key.startsWith('qb_live_') && !key.startsWith('qb_test_'))) {
      return null;
    }

    const hash = this.hashKey(key);
    const apiKey = await this.apiKeyRepository.getByKeyHash(hash);
    if (!apiKey) return null;

    // Fire-and-forget update lastUsedAt
    this.apiKeyRepository.updateLastUsed(hash).catch(() => {});

    return {
      businessId: apiKey.businessId,
      scopes: apiKey.scopes,
      keyId: apiKey.id,
    };
  }
}
