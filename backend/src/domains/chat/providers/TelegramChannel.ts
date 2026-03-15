import { Injectable, Logger } from '@nestjs/common';
import {
  IMessagingChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelName,
} from '../interfaces/IMessagingChannel';

@Injectable()
export class TelegramChannel implements IMessagingChannel {
  readonly channelName: ChannelName = 'telegram';
  private readonly logger = new Logger(TelegramChannel.name);
  private readonly botToken: string;
  private readonly apiBase: string;

  constructor() {
    this.botToken = process.env['TELEGRAM_BOT_TOKEN'] ?? '';
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
  }

  async send(message: OutgoingMessage): Promise<void> {
    if (!this.botToken) {
      this.logger.warn('Telegram not configured — TELEGRAM_BOT_TOKEN missing');
      return;
    }

    const hasButtons = message.replyButtons && message.replyButtons.length > 0;

    const body: Record<string, unknown> = {
      chat_id: message.channelUserId,
      text: message.text,
      parse_mode: 'Markdown',
    };

    if (hasButtons) {
      body['reply_markup'] = {
        inline_keyboard: [
          message.replyButtons!.map(btn => ({ text: btn.label, callback_data: btn.id })),
        ],
      };
    }

    const res = await fetch(`${this.apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`Telegram send failed: ${res.status} ${err}`);
    }
  }

  parseIncoming(rawPayload: unknown): IncomingMessage | null {
    try {
      const payload = rawPayload as {
        message?: {
          chat: { id: number };
          text?: string;
          voice?: { file_id: string };
          photo?: Array<{ file_id: string }>;
          date: number;
        };
        callback_query?: {
          message: { chat: { id: number }; date: number };
          data: string;
        };
      };

      // Handle callback_query (button taps)
      if (payload.callback_query) {
        const cq = payload.callback_query;
        return {
          channelUserId: String(cq.message.chat.id),
          text: cq.data,
          channel: 'telegram',
          timestamp: new Date(cq.message.date * 1000).toISOString(),
          raw: rawPayload,
        };
      }

      const msg = payload.message;
      if (!msg) return null;

      return {
        channelUserId: String(msg.chat.id),
        text: msg.text,
        audioUrl: msg.voice ? `telegram-voice:${msg.voice.file_id}` : undefined,
        imageUrl: msg.photo
          ? `telegram-photo:${msg.photo[msg.photo.length - 1]?.file_id}`
          : undefined,
        channel: 'telegram',
        timestamp: new Date(msg.date * 1000).toISOString(),
        raw: rawPayload,
      };
    } catch (err) {
      this.logger.error('Failed to parse Telegram payload', err);
      return null;
    }
  }

  /**
   * Fetch Telegram voice note by file_id. Returns the raw audio buffer for transcription.
   */
  async fetchVoiceToBuffer(fileId: string): Promise<Buffer> {
    if (!this.botToken) throw new Error('Telegram bot token not configured');
    const res = await fetch(`${this.apiBase}/getFile?file_id=${encodeURIComponent(fileId)}`);
    if (!res.ok) throw new Error(`Telegram getFile failed: ${res.status}`);
    const json = (await res.json()) as { ok?: boolean; result?: { file_path?: string } };
    if (!json.ok || !json.result?.file_path) throw new Error('Invalid Telegram getFile response');
    const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${json.result.file_path}`;
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error(`Telegram file download failed: ${fileRes.status}`);
    return Buffer.from(await fileRes.arrayBuffer());
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const token = headers['x-telegram-bot-api-secret-token'] ?? '';
    const expected = process.env['TELEGRAM_WEBHOOK_SECRET'] ?? '';
    // Not configured — allow in dev mode
    if (!expected) return true;
    return token === expected;
  }
}
