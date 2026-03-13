"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/ui/error-view";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <div className="w-full max-w-lg">
        <ErrorView
          code={500}
          onRetry={reset}
          primaryLabel="Go to dashboard"
          primaryHref="/"
        />
      </div>
    </div>
  );
}
