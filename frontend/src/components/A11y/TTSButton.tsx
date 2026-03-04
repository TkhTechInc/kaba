"use client";

import { useTTS } from "@/hooks/use-tts";
import { useLocale } from "@/contexts/locale-context";

export function TTSButton({
  text,
  "aria-label": ariaLabel,
  className,
}: {
  text: string;
  "aria-label"?: string;
  className?: string;
}) {
  const { speak, speaking } = useTTS();
  const { locale, t } = useLocale();
  const lang = locale === "fr" ? "fr-FR" : "en";

  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      className={className ?? "ml-1 inline-flex rounded p-1 text-dark-6 hover:bg-gray-2 hover:text-dark-4 focus:outline-none focus:ring-2 focus:ring-primary dark:text-dark-5 dark:hover:bg-dark-3"}
      aria-label={ariaLabel ?? t("common.readAloud")}
      disabled={speaking}
    >
      <span className="sr-only">{t("common.readAloud")}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    </button>
  );
}
