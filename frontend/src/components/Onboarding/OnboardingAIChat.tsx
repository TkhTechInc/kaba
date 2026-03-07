"use client";

import { useOnboardingAI, type OnboardingAISuggestion } from "@/hooks/use-onboarding-ai";
import { SearchIcon } from "@/assets/icons";
import { cn } from "@/lib/utils";
import React, { useState } from "react";

const LABELS: Record<keyof OnboardingAISuggestion, string> = {
  businessName: "Business name",
  businessType: "Business type",
  country: "Country",
  currency: "Currency",
  taxRegime: "Tax regime",
  message: "Message",
};

const DISPLAY_KEYS: (keyof OnboardingAISuggestion)[] = [
  "businessName",
  "businessType",
  "country",
  "currency",
  "taxRegime",
];

export function OnboardingAIChat({
  businessId,
  onApplySuggestion,
  collapsed: initialCollapsed = false,
}: {
  businessId: string;
  onApplySuggestion: (s: Partial<OnboardingAISuggestion>) => void;
  collapsed?: boolean;
}) {
  const { sendMessage, loading, error } = useOnboardingAI(businessId);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [lastSuggestion, setLastSuggestion] = useState<OnboardingAISuggestion | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    try {
      const suggestion = await sendMessage(userMsg);
      setLastSuggestion(suggestion);
      const aiText = suggestion.message ?? "I've extracted some details. Click the chips below to apply them.";
      setMessages((m) => [...m, { role: "ai", text: aiText }]);
    } catch {
      setMessages((m) => [...m, { role: "ai", text: "Sorry, I couldn't process that. Please try again." }]);
    }
  };

  const handleChipClick = (key: keyof OnboardingAISuggestion, value: string) => {
    const partial: Partial<OnboardingAISuggestion> = { [key]: value };
    onApplySuggestion(partial);
  };

  const hasSuggestions = lastSuggestion && DISPLAY_KEYS.some((k) => lastSuggestion[k]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-stroke bg-white dark:border-dark-3 dark:bg-dark-2",
        collapsed ? "w-14" : "w-full max-w-sm"
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between gap-2 border-b border-stroke px-4 py-3 text-left font-medium text-dark dark:border-dark-3 dark:text-white"
      >
        {!collapsed && <span>AI assistant</span>}
        <span
          className={cn(
            "inline-block transition-transform",
            collapsed ? "rotate-180" : ""
          )}
        >
          ▼
        </span>
      </button>

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-body-sm text-dark-6 dark:text-dark-6">
                Describe your business, e.g. &quot;I run a small shop in Benin&quot;
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "mb-3 rounded-lg px-3 py-2 text-body-sm",
                  msg.role === "user"
                    ? "ml-4 bg-primary/10 text-dark dark:text-white"
                    : "mr-4 bg-gray-2 text-dark dark:bg-dark-3 dark:text-white"
                )}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="mb-3 flex items-center gap-2 text-body-sm text-dark-6">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Thinking...
              </div>
            )}
            {error && (
              <p className="mb-3 text-body-sm text-red">{error.message}</p>
            )}
            {hasSuggestions && (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-body-xs font-medium text-dark-6 dark:text-dark-6">
                    Apply to form:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const all: Partial<OnboardingAISuggestion> = {};
                      DISPLAY_KEYS.forEach((k) => { if (lastSuggestion![k]) all[k] = lastSuggestion![k]; });
                      onApplySuggestion(all);
                    }}
                    className="text-body-xs font-medium text-primary underline hover:text-primary/80"
                  >
                    Apply all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DISPLAY_KEYS.map((key) => {
                    const val = lastSuggestion![key];
                    if (!val) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleChipClick(key, val)}
                        className="rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-body-xs font-medium text-primary transition hover:bg-primary/20 dark:border-primary dark:bg-primary/20 dark:hover:bg-primary/30"
                      >
                        {LABELS[key]}: {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="border-t border-stroke p-3 dark:border-dark-3">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your business..."
                className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-4 pr-10 outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:focus:border-primary"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-6 hover:text-primary disabled:opacity-50"
              >
                <SearchIcon className="h-5 w-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
