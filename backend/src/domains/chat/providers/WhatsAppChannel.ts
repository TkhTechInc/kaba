import { Injectable, Logger } from '@nestjs/common';
import {
  IMessagingChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelName,
} from '../interfaces/IMessagingChannel';
import * as crypto from 'crypto';

// Meta WhatsApp Cloud API v20
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
const WA_API_BASE = 'https://graph.facebook.com/v20.0';

@Injectable()
export class WhatsAppChannel implements IMessagingChannel {
  readonly channelName: ChannelName = 'whatsapp';
  private readonly logger = new Logger(WhatsAppChannel.name);
  private readonly token: string;
  private readonly phoneNumberId: string;
  private readonly appSecret: string;

  constructor() {
    this.token = process.env['WHATSAPP_TOKEN'] ?? '';
    this.phoneNumberId = process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '';
    this.appSecret = process.env['WHATSAPP_APP_SECRET'] ?? '';
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.token || !this.phoneNumberId) {
      this.logger.warn('WhatsApp not configured — WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID missing');
      return;
    }

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: message.channelUserId,
      type: 'text',
      text: { body: message.text },
    };

    // If reply buttons provided, use interactive message type
    if (message.replyButtons && message.replyButtons.length > 0) {
      body['type'] = 'interactive';
      delete body['text'];
      body['interactive'] = {
        type: 'button',
        body: { text: message.text },
        action: {
          buttons: message.replyButtons.slice(0, 3).map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.label.slice(0, 20) },
          })),
        },
      };
    }

    const url = `${WA_API_BASE}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`WhatsApp send failed: ${res.status} ${err}`);
    }
  }

  parseIncoming(rawPayload: unknown): IncomingMessage | null {
    try {
      const payload = rawPayload as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: Array<{
                from: string;
                type: string;
                text?: { body: string };
                audio?: { id: string };
                image?: { id: string; link?: string };
                timestamp: string;
              }>;
            };
          }>;
        }>;
      };

      const msg = payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!msg) return null;

      return {
        channelUserId: msg.from,
        text: msg.type === 'text' ? msg.text?.body : undefined,
        audioUrl: msg.type === 'audio' ? `whatsapp-media:${msg.audio?.id}` : undefined,
        imageUrl:
          msg.type === 'image'
            ? (msg.image?.link ?? `whatsapp-media:${msg.image?.id}`)
            : undefined,
        channel: 'whatsapp',
        timestamp: new Date(parseInt(msg.timestamp, 10) * 1000).toISOString(),
        raw: rawPayload,
      };
    } catch (err) {
      this.logger.error('Failed to parse WhatsApp payload', err);
      return null;
    }
  }

  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean {
    const signature = headers['x-hub-signature-256'] ?? '';
    if (!this.appSecret || !signature) return false;
    const expected =
      'sha256=' + crypto.createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
