export type ChannelName = 'whatsapp' | 'telegram';

export interface IncomingMessage {
  channelUserId: string;       // WhatsApp phone number / Telegram chat_id
  text?: string;
  audioUrl?: string;
  imageUrl?: string;
  channel: ChannelName;
  timestamp: string;
  raw?: unknown;               // original payload for debugging
}

export interface OutgoingMessage {
  channelUserId: string;
  text: string;
  replyButtons?: Array<{ id: string; label: string }>;
  documentUrl?: string;        // for PDF invoices
  documentName?: string;
}

export interface IMessagingChannel {
  readonly channelName: ChannelName;
  send(message: OutgoingMessage): Promise<void>;
  parseIncoming(rawPayload: unknown): IncomingMessage | null;
  verifyWebhook?(headers: Record<string, string>, rawBody: string): boolean;
}
