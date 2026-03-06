"use client";

import { SearchIcon } from "@/assets/icons";
import Image from "next/image";
import Link from "next/link";
import { useSidebarContext } from "../sidebar/sidebar-context";
import { MenuIcon } from "./icons";
import { Notification } from "./notification";
import { ThemeToggleSwitch } from "./theme-toggle";
import { UserInfo } from "./user-info";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function Header() {
  const { toggleSidebar, isMobile } = useSidebarContext();
  const { isInstallable, promptInstall } = useInstallPrompt();

  return (
    <header className="sticky top-0 z-30 flex min-w-0 items-center justify-between gap-2 border-b border-stroke bg-white px-3 py-4 shadow-1 dark:border-stroke-dark dark:bg-gray-dark sm:gap-4 sm:px-4 sm:py-5 md:px-5 2xl:px-10">
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="rounded-lg border px-1.5 py-1 dark:border-stroke-dark dark:bg-[#020D1A] hover:dark:bg-[#FFFFFF1A] lg:hidden"
          aria-label="Toggle menu"
        >
          <MenuIcon />
        </button>

        {isMobile && (
          <Link href={"/"} className="hidden sm:block">
            <Image
              src={"/images/logo/logo-icon.svg"}
              width={32}
              height={32}
              alt=""
              role="presentation"
            />
          </Link>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2 md:gap-4">
        <div className="relative hidden min-w-0 sm:block sm:max-w-[200px] md:max-w-[260px] lg:max-w-[300px]">
          <input
            type="search"
            placeholder="Search"
            className="w-full min-w-0 rounded-full border bg-gray-2 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus-visible:border-primary dark:border-dark-3 dark:bg-dark-2 dark:hover:border-dark-4 dark:hover:bg-dark-3 dark:hover:text-dark-6 dark:focus-visible:border-primary sm:py-3 sm:pl-[42px] sm:pr-5 md:pl-[53px]"
          />
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 sm:left-4 sm:size-5 md:left-5" />
        </div>

        <div className="shrink-0">
          <LanguagePicker />
        </div>

        <div className="shrink-0">
          <ThemeToggleSwitch />
        </div>

        {isInstallable && (
          <button
            onClick={promptInstall}
            className="hidden items-center gap-1.5 rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2 sm:flex"
            aria-label="Install Kaba app"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Install App
          </button>
        )}

        <div className="shrink-0">
          <Notification />
        </div>

        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}
