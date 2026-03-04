"use client";

import { AuthGuard } from "@/components/Auth/AuthGuard";
import { OnboardingGuard } from "@/components/Auth/OnboardingGuard";
import { Header } from "@/components/Layouts/header";
import { Sidebar } from "@/components/Layouts/sidebar";
import { SkipLink } from "@/components/A11y/SkipLink";
import { OfflineBanner } from "@/components/OfflineBanner";
import type { PropsWithChildren } from "react";

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <AuthGuard>
      <OnboardingGuard>
        <div className="relative flex min-h-screen">
          <SkipLink />
          <Sidebar />
          <div className="w-full bg-gray-2 dark:bg-[#020d1a]">
            <Header />
            <main id="main-content" className="isolate mx-auto w-full max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10" tabIndex={-1}>
              {children}
            </main>
          </div>
          <OfflineBanner />
        </div>
      </OnboardingGuard>
    </AuthGuard>
  );
}
