import { api } from "@/lib/api-client";

export interface AgentMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

export interface AgentResponse {
  message: string;
  toolsUsed: string[];
  upgradeRequired?: { feature: string; requiredTier: string };
  sessionId: string;
}

export function createMcpApi(token: string | null) {
  const opts = { token: token ?? undefined };
  return {
    chat: (businessId: string, message: string, sessionId?: string, locale?: string) =>
      api.post<AgentResponse>(
        "/api/v1/mcp/chat",
        { businessId, message, sessionId, locale },
        opts
      ),
    portalChat: (
      businessId: string,
      customerEmail: string,
      message: string,
      sessionId?: string,
      locale?: string
    ) =>
      api.post<AgentResponse>(
        "/api/v1/mcp/portal/chat",
        { businessId, customerEmail, message, sessionId, locale },
        opts
      ),
    adminChat: (message: string, sessionId?: string) =>
      api.post<AgentResponse>(
        "/api/v1/mcp/admin/chat",
        { message, sessionId },
        opts
      ),
  };
}
