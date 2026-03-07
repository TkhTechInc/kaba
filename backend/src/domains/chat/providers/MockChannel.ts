import { Injectable, Logger } from '@nestjs/common';
import { IMessagingChannel, IncomingMessage, OutgoingMessage } from '../interfaces/IMessagingChannel';

@Injectable()
export class MockChannel implements IMessagingChannel {
  readonly channelName = 'whatsapp' as const;
  private readonly logger = new Logger(MockChannel.name);
  readonly sent: OutgoingMessage[] = [];

  async send(message: OutgoingMessage): Promise<void> {
    this.logger.log(`[MockChannel] → ${message.channelUserId}: ${message.text}`);
    this.sent.push(message);
  }

  parseIncoming(rawPayload: unknown): IncomingMessage | null {
    if (typeof rawPayload === 'object' && rawPayload !== null && 'text' in rawPayload) {
      const p = rawPayload as { text: string; channelUserId?: string };
      return {
        channelUserId: p.channelUserId ?? 'mock-user',
        text: p.text,
        channel: 'whatsapp',
        timestamp: new Date().toISOString(),
        raw: rawPayload,
      };
    }
    return null;
  }

  verifyWebhook(): boolean {
    return true;
  }
}
