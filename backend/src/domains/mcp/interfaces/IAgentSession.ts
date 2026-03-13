export type AgentMessageRole = 'user' | 'assistant' | 'tool';

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
}

export interface IAgentSession {
  sessionId: string;
  scope: 'business' | 'customer' | 'admin';
  businessId: string;
  userId?: string;
  customerEmail?: string;
  messages: AgentMessage[];
  ttl: number;
}
