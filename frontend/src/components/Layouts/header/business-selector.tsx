"use client";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { ChevronUp } from "@/components/Layouts/sidebar/icons";
import { useState } from "react";
import { useClickOutside } from "@/hooks/use-click-outside";

export function BusinessSelector() {
  const { businesses, businessId, setBusinessId } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  if (businesses.length === 0) return null;
  if (businesses.length === 1) {
    return (
      <span className="text-sm font-medium text-dark-4 dark:text-dark-6">
        {businesses[0].businessId}
      </span>
    );
  }

  const current = businesses.find((b) => b.businessId === businessId) ?? businesses[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
          "border-stroke bg-white dark:border-stroke-dark dark:bg-dark-2",
          "hover:bg-gray-100 dark:hover:bg-[#FFFFFF1A]"
        )}
      >
        <span className="truncate max-w-[140px]">{current.businessId}</span>
        <ChevronUp
          className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul
          className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-stroke bg-white py-1 shadow-lg dark:border-stroke-dark dark:bg-gray-dark"
          role="listbox"
        >
          {businesses.map((b) => (
            <li key={b.businessId} role="option">
              <button
                type="button"
                onClick={() => {
                  setBusinessId(b.businessId);
                  setOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm",
                  b.businessId === businessId
                    ? "bg-primary/10 font-medium text-primary"
                    : "hover:bg-gray-100 dark:hover:bg-[#FFFFFF1A]"
                )}
              >
                {b.businessId}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
