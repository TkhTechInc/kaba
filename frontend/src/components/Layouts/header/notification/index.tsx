"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useAuthOptional } from "@/contexts/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  notificationsService,
  type Notification,
  type NotificationType,
} from "@/services/notifications.service";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "./icons";

// ---------------------------------------------------------------------------
// Icon per notification type
// ---------------------------------------------------------------------------
function NotifIcon({ type }: { type: NotificationType }) {
  const base = "flex size-10 flex-shrink-0 items-center justify-center rounded-full text-lg";
  switch (type) {
    case "invoice.paid":
    case "payment.received":
      return <span className={cn(base, "bg-green-100 dark:bg-green-900/30")}>💰</span>;
    case "invoice.created":
      return <span className={cn(base, "bg-blue-100 dark:bg-blue-900/30")}>🧾</span>;
    case "invoice.overdue":
      return <span className={cn(base, "bg-red-100 dark:bg-red-900/30")}>⚠️</span>;
    case "team.member_joined":
      return <span className={cn(base, "bg-purple-100 dark:bg-purple-900/30")}>🙌</span>;
    case "team.member_invited":
      return <span className={cn(base, "bg-indigo-100 dark:bg-indigo-900/30")}>✉️</span>;
    case "debt.reminder":
      return <span className={cn(base, "bg-amber-100 dark:bg-amber-900/30")}>🔔</span>;
    case "plan.upgraded":
    case "plan.expiring":
      return <span className={cn(base, "bg-cyan-100 dark:bg-cyan-900/30")}>⭐</span>;
    default:
      return <span className={cn(base, "bg-gray-100 dark:bg-dark-3")}>📌</span>;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 30_000;

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const auth = useAuthOptional();
  const isMobile = useIsMobile();

  const fetch = useCallback(async () => {
    if (!auth?.token || !auth?.businessId) return;
    try {
      const res = await notificationsService.list(auth.businessId, auth.token);
      setNotifications(res.items);
      setUnread(res.unread);
    } catch {
      // fail silently — don't break the header
    }
  }, [auth?.token, auth?.businessId]);

  // Initial load + polling
  useEffect(() => {
    fetch();
    pollRef.current = setInterval(fetch, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetch]);

  const handleOpen = useCallback(
    (value: React.SetStateAction<boolean>) => {
      setIsOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next) {
          setLoading(true);
          fetch().finally(() => setLoading(false));
        }
        return next;
      });
    },
    [fetch]
  );

  const handleMarkRead = async (notif: Notification) => {
    if (notif.read || !auth?.token || !auth?.businessId) return;
    try {
      await notificationsService.markRead(
        auth.businessId,
        notif.id,
        notif.createdAt,
        auth.token,
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!auth?.token || !auth?.businessId) return;
    try {
      await notificationsService.markAllRead(auth.businessId, auth.token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  };

  return (
    <Dropdown isOpen={isOpen} setIsOpen={handleOpen}>
      <DropdownTrigger
        className="grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary"
        aria-label="View Notifications"
      >
        <span className="relative">
          <BellIcon />
          {unread > 0 && (
            <span className="absolute right-0 top-0 z-1 flex size-2 items-center justify-center rounded-full bg-red-light ring-2 ring-gray-2 dark:ring-dark-3">
              <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
            </span>
          )}
        </span>
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-dark-3 dark:bg-gray-dark min-[350px]:min-w-[22rem]"
      >
        {/* Header */}
        <div className="mb-1 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">
            Notifications
          </span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
                {unread} new
              </span>
            )}
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <ul className="mb-3 max-h-[24rem] space-y-1 overflow-y-auto">
          {loading && notifications.length === 0 && (
            <li className="px-2 py-6 text-center text-sm text-gray-5 dark:text-dark-6">
              Loading…
            </li>
          )}

          {!loading && notifications.length === 0 && (
            <li className="px-2 py-8 text-center">
              <p className="text-2xl">🔔</p>
              <p className="mt-2 text-sm font-medium text-dark dark:text-white">
                No notifications yet
              </p>
              <p className="text-xs text-gray-5 dark:text-dark-6">
                You&apos;ll see invoice, payment and team events here.
              </p>
            </li>
          )}

          {notifications.map((notif) => {
            const inner = (
              <button
                onClick={() => handleMarkRead(notif)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-gray-2 focus-visible:bg-gray-2 dark:hover:bg-dark-3 dark:focus-visible:bg-dark-3",
                  !notif.read && "bg-blue-light-5 dark:bg-dark-3/60",
                )}
              >
                <NotifIcon type={notif.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <strong className="block truncate text-sm font-medium text-dark dark:text-white">
                      {notif.title}
                    </strong>
                    {!notif.read && (
                      <span className="mt-1 size-2 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="block truncate text-xs text-gray-5 dark:text-dark-6">
                    {notif.body}
                  </span>
                  <span className="block text-xs text-gray-4 dark:text-dark-5 mt-0.5">
                    {timeAgo(notif.createdAt)}
                  </span>
                </div>
              </button>
            );

            return (
              <li key={notif.id} role="menuitem">
                {notif.link ? (
                  <Link
                    href={notif.link}
                    onClick={() => {
                      void handleMarkRead(notif);
                      setIsOpen(false);
                    }}
                    className="block"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </DropdownContent>
    </Dropdown>
  );
}
