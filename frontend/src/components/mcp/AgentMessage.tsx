"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/use-agent-chat";

interface AgentMessageProps {
  message: ChatMessage;
}

export function AgentMessage({ message }: AgentMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("mb-3 flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          K
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "rounded-br-sm bg-primary text-white"
            : "rounded-bl-sm bg-gray-2 text-dark dark:bg-dark-2 dark:text-white"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary dark:bg-primary/20"
              >
                {tool.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}

        {message.upgradeRequired && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-900/30">
            <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-300">
              Upgrade to {message.upgradeRequired.requiredTier} to unlock{" "}
              {message.upgradeRequired.feature}
            </p>
            <Link
              href="/settings/plans"
              className="inline-block rounded-lg bg-amber-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
            >
              Upgrade plan
            </Link>
          </div>
        )}

        <p className="mt-1 text-xs opacity-50">
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
