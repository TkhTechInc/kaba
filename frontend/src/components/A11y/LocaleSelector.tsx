"use client";

import { useLocale } from "@/contexts/locale-context";

export function LocaleSelector() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex gap-1 rounded-lg border border-stroke bg-white p-1 dark:border-dark-3 dark:bg-gray-dark">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          locale === "en"
            ? "bg-primary text-white"
            : "text-dark-6 hover:bg-gray-2 dark:text-dark-5 dark:hover:bg-dark-3"
        }`}
        aria-pressed={locale === "en"}
        aria-label="English"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("fr")}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          locale === "fr"
            ? "bg-primary text-white"
            : "text-dark-6 hover:bg-gray-2 dark:text-dark-5 dark:hover:bg-dark-3"
        }`}
        aria-pressed={locale === "fr"}
        aria-label="Français"
      >
        FR
      </button>
    </div>
  );
}
