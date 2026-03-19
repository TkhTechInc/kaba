"use client";
import { useState, useRef, useEffect } from "react";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { useLocale } from "@/contexts/locale-context";
import { AgentMessage } from "./AgentMessage";

const SUGGESTION_KEYS = [
  "aiChat.suggestions.checkBalance",
  "aiChat.suggestions.listUnpaidInvoices",
  "aiChat.suggestions.whoOwesMe",
  "aiChat.suggestions.monthlyProfit",
] as const;

interface AgentChatWidgetProps {
  token: string | null;
  businessId: string;
  customerEmail?: string;
  mode?: "business" | "portal";
}

export function AgentChatWidget({
  token,
  businessId,
  customerEmail,
  mode = "business",
}: AgentChatWidgetProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, error, sendMessage, clearMessages } =
    useAgentChat({ token, businessId, customerEmail, mode });

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!businessId) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={isOpen ? t("aiChat.closeLabel") : t("aiChat.openLabel")}
      >
        {isOpen ? (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-xl border border-stroke bg-white shadow-xl dark:border-dark-3 dark:bg-gray-dark">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                K
              </div>
              <div>
                <p className="text-sm font-semibold leading-none">{t("aiChat.title")}</p>
                <p className="mt-0.5 text-xs text-white/70">
                  {t("aiChat.subtitle")}
                </p>
              </div>
            </div>
            <button
              onClick={clearMessages}
              className="text-xs text-white/70 transition-colors hover:text-white"
              title={t("aiChat.clearTitle")}
              type="button"
            >
              {t("aiChat.clear")}
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center text-dark-4 dark:text-dark-6">
                <p className="mb-3 text-sm font-medium text-dark dark:text-white">
                  {t("aiChat.greeting")}
                </p>
                <div className="w-full space-y-2 text-left text-xs">
                  {SUGGESTION_KEYS.map((key) => {
                    const text = t(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => sendMessage(text)}
                        className="w-full rounded-xl bg-gray-2 px-3 py-2 text-left text-dark-4 transition-colors hover:bg-gray-3 dark:bg-dark-2 dark:text-dark-6 dark:hover:bg-dark-3"
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <AgentMessage key={msg.id} message={msg} />
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 px-2 text-sm text-dark-4 dark:text-dark-6">
                <div className="flex gap-1">
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-dark-4 dark:bg-dark-6"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-dark-4 dark:bg-dark-6"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-dark-4 dark:bg-dark-6"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="px-2 text-xs text-red">{t("aiChat.error")}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-stroke px-3 py-3 dark:border-dark-3"
          >
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("aiChat.placeholder")}
                className="flex-1 rounded-xl border border-stroke bg-gray-2 px-3 py-2 text-sm text-dark placeholder-dark-4 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:placeholder-dark-4 dark:focus:border-primary"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-primary px-3 py-2 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
