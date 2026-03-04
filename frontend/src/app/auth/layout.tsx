import type { PropsWithChildren } from "react";
import { SkipLink } from "@/components/A11y/SkipLink";
import { LocaleSelector } from "@/components/A11y/LocaleSelector";

/**
 * Auth layout - minimal layout for sign-in, sign-up, forgot-password.
 * No sidebar/header. Centered content for auth forms.
 */
export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-2 px-4 py-10 dark:bg-[#020d1a]">
      <SkipLink />
      <div className="absolute right-4 top-4">
        <LocaleSelector />
      </div>
      <div id="main-content" className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
