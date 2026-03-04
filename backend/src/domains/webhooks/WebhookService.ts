import { Inject, Injectable, Optional } from '@nestjs/common';
import { createHmac } from 'crypto';
import { WebhookRepository } from './repositories/WebhookRepository';
import { Webhook, CreateWebhookInput, WebhookEvent } from './models/Webhook';
import { NotFoundError } from '@/shared/errors/DomainError';
import { IAuditLogger } from '../audit/interfaces/IAuditLogger';
import { AUDIT_LOGGER } from '../audit/AuditModule';

@Injectable()
export class WebhookService {
  constructor(
    private readonly webhookRepository: WebhookRepository,
    @Optional() @Inject(AUDIT_LOGGER) private readonly auditLogger?: IAuditLogger,
  ) {}

  async register(input: CreateWebhookInput, userId?: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.create(input);

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'Webhook',
        entityId: webhook.id,
        businessId: webhook.businessId,
        action: 'register',
        userId,
        changes: { url: { to: webhook.url }, events: { to: webhook.events } },
      });
    }

    return webhook;
  }

  async unregister(businessId: string, id: string, userId?: string): Promise<void> {
    const existing = await this.webhookRepository.getById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Webhook', id);
    }
    await this.webhookRepository.delete(businessId, id);

    if (this.auditLogger && userId) {
      await this.auditLogger.log({
        entityType: 'Webhook',
        entityId: id,
        businessId,
        action: 'unregister',
        userId,
        changes: { url: { from: existing.url, to: null } },
      });
    }
  }

  async list(businessId: string): Promise<Webhook[]> {
    const webhooks = await this.webhookRepository.listByBusiness(businessId);
    return webhooks.map((w) => ({
      ...w,
      secret: '***', // Never return secret to client
    }));
  }

  /**
   * Emit event to all registered webhooks for the business.
   * Fire-and-forget: does not block, errors are logged.
   */
  emit(businessId: string, event: WebhookEvent, payload: Record<string, unknown>): void {
    this.webhookRepository.listByBusiness(businessId).then((webhooks) => {
      const body = JSON.stringify({
        event,
        payload,
        timestamp: new Date().toISOString(),
      });

      for (const webhook of webhooks) {
        if (!webhook.enabled || !webhook.events.includes(event)) continue;

        const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

        fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': event,
          },
          body,
        }).catch((err) => {
          console.error(`Webhook delivery failed [${webhook.id}] ${webhook.url}:`, err);
        });
      }
    }).catch((err) => {
      console.error('Webhook emit list failed:', err);
    });
  }
}
