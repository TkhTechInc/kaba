import { ChannelName } from './IMessagingChannel';
import { ParsedIntent } from './IIntentParser';

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  ts: string;
}

export interface ChatSession {
  id: string;              // `${channelUserId}:${channel}`
  businessId: string;
  userId: string;          // Kaba userId linked to this phone/chat
  channel: ChannelName;
  channelUserId: string;
  history: ChatMessage[];
  pendingIntent?: ParsedIntent;
  updatedAt: string;
}

export interface IConversationStore {
  get(sessionId: string): Promise<ChatSession | null>;
  save(session: ChatSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
}
