"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/contexts/locale-context";

export interface DateRange {
  fromDate: string;
  toDate: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  onClear: () => void;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  onClear,
  className = "",
}: DateRangeFilterProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);

  const isActive = value.fromDate || value.toDate;

  const handleApply = useCallback(() => {
    onChange(draft);
    setOpen(false);
  }, [draft, onChange]);

  const handleClear = useCallback(() => {
    const empty = { fromDate: "", toDate: "" };
    setDraft(empty);
    onClear();
    setOpen(false);
  }, [onClear]);

  const handleOpen = () => {
    setDraft(value);
    setOpen(true);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          isActive
            ? "border-primary bg-primary/10 text-primary dark:border-primary/60 dark:bg-primary/20"
            : "border-stroke bg-white text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:bg-gray-dark dark:text-dark-6 dark:hover:border-primary/60"
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <CalendarIcon className="h-4 w-4" />
        {isActive
          ? t("dateFilter.activeRange", {
              from: value.fromDate || "…",
              to: value.toDate || "…",
            })
          : t("dateFilter.button")}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Popover */}
          <div
            role="dialog"
            aria-label={t("dateFilter.label")}
            className="absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-xl border border-stroke bg-white p-4 shadow-lg dark:border-dark-3 dark:bg-gray-dark"
          >
            <p className="mb-3 text-sm font-semibold text-dark dark:text-white">
              {t("dateFilter.label")}
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-dark-4 dark:text-dark-6">
                  {t("dateFilter.from")}
                </span>
                <input
                  type="date"
                  value={draft.fromDate}
                  max={draft.toDate || undefined}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, fromDate: e.target.value }))
                  }
                  className="rounded-lg border border-stroke px-3 py-1.5 text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-dark-4 dark:text-dark-6">
                  {t("dateFilter.to")}
                </span>
                <input
                  type="date"
                  value={draft.toDate}
                  min={draft.fromDate || undefined}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, toDate: e.target.value }))
                  }
                  className="rounded-lg border border-stroke px-3 py-1.5 text-sm text-dark focus:border-primary focus:outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-white"
                />
              </label>
            </div>

            {/* Quick presets */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDraft(p.range())}
                  className="rounded-full border border-stroke px-2.5 py-0.5 text-xs text-dark-4 hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-6"
                >
                  {t(`dateFilter.preset.${p.key}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-dark-4 hover:text-dark dark:text-dark-6 dark:hover:text-white"
              >
                {t("dateFilter.clear")}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draft.fromDate && !draft.toDate}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {t("dateFilter.apply")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

const PRESETS: { key: string; range: () => DateRange }[] = [
  {
    key: "today",
    range: () => {
      const d = isoDate(new Date());
      return { fromDate: d, toDate: d };
    },
  },
  {
    key: "thisWeek",
    range: () => {
      const now = new Date();
      const day = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((day + 6) % 7));
      return { fromDate: isoDate(mon), toDate: isoDate(now) };
    },
  },
  {
    key: "thisMonth",
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { fromDate: isoDate(first), toDate: isoDate(now) };
    },
  },
  {
    key: "lastMonth",
    range: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { fromDate: isoDate(first), toDate: isoDate(last) };
    },
  },
  {
    key: "last3Months",
    range: () => {
      const now = new Date();
      const from = new Date(now);
      from.setMonth(from.getMonth() - 3);
      return { fromDate: isoDate(from), toDate: isoDate(now) };
    },
  },
  {
    key: "thisYear",
    range: () => {
      const now = new Date();
      return {
        fromDate: `${now.getFullYear()}-01-01`,
        toDate: isoDate(now),
      };
    },
  },
];

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="2.5" y="4" width="15" height="13.5" rx="2" />
      <path d="M2.5 8h15M7 2v4M13 2v4" strokeLinecap="round" />
    </svg>
  );
}
