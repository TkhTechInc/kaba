"use client";
import { useState, useCallback, useRef } from "react";
import { createMcpApi } from "@/services/mcp.service";
import { useLocale } from "@/contexts/locale-context";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  upgradeRequired?: { feature: string; requiredTier: string };
  timestamp: Date;
}

export function useAgentChat(options: {
  token: string | null;
  businessId: string;
  customerEmail?: string;
  mode: "business" | "portal";
}) {
  const { locale } = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      const localeForApi = locale === "fr" ? "fr" : locale === "en" ? "en" : undefined;

      try {
        const mcpApi = createMcpApi(options.token);
        let response;

        if (options.mode === "portal" && options.customerEmail) {
          const res = await mcpApi.portalChat(
            options.businessId,
            options.customerEmail,
            text.trim(),
            sessionIdRef.current,
            localeForApi
          );
          response = res.data;
        } else {
          const res = await mcpApi.chat(
            options.businessId,
            text.trim(),
            sessionIdRef.current,
            localeForApi
          );
          response = res.data;
        }

        sessionIdRef.current = response.sessionId;

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.message,
          toolsUsed: response.toolsUsed,
          upgradeRequired: response.upgradeRequired,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [options, isLoading, locale]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = undefined;
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
