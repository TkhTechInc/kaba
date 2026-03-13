"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/ui/error-view";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Forward to your error reporting service here if needed
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <ErrorView
      code={500}
      onRetry={reset}
      fullPage
    />
  );
}
