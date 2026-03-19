"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocale } from "@/contexts/locale-context";
import {
  HomeIcon,
  ShieldIcon,
  PieChart,
  ChartBarIcon,
  Table,
  ReceiptIcon,
  DocumentIcon,
  SettingsIcon,
} from "../sidebar/icons";
import { MenuIcon } from "../header/icons";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const ADMIN_NAV_KEYS = [
  { key: "dashboard", url: "/admin/dashboard", icon: HomeIcon },
  { key: "health", url: "/admin/health", icon: ShieldIcon },
  { key: "receipts", url: "/admin/receipts", icon: ReceiptIcon },
  { key: "metrics", url: "/admin/metrics", icon: PieChart },
  { key: "usage", url: "/admin/usage", icon: ChartBarIcon },
  { key: "activity", url: "/admin/activity", icon: Table },
  { key: "auditLogs", url: "/admin/audit-logs", icon: ReceiptIcon },
  { key: "leakageReport", url: "/admin/leakage", icon: ShieldIcon },
  { key: "aiQuery", url: "/admin/ai", icon: DocumentIcon },
  { key: "businesses", url: "/admin/businesses", icon: Table },
  { key: "debts", url: "/admin/debts", icon: ReceiptIcon },
  { key: "users", url: "/admin/users", icon: DocumentIcon },
  { key: "features", url: "/admin/features", icon: SettingsIcon },
];

function NavLink({
  href,
  isActive,
  icon: Icon,
  children,
  onNavigate,
}: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<IconProps>;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        isActive
          ? "bg-primary/10 text-primary dark:bg-primary/20"
          : "text-dark-6 hover:bg-gray-2 hover:text-dark dark:text-dark-6 dark:hover:bg-dark-2 dark:hover:text-white"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}

function ArrowLeftIcon(props: IconProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const closeNav = () => setIsOpen(false);

  useEffect(() => {
    if (!isMobile) setIsOpen(true);
    else setIsOpen(false);
  }, [isMobile]);

  return (
    <div className="flex shrink-0 flex-col">
      {isMobile && (
        <div className="flex items-center gap-2 border-b border-stroke bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-dark min-[850px]:hidden">
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            className="rounded-lg border px-2 py-1.5 dark:border-stroke-dark dark:bg-[#020D1A]"
            aria-label={t("admin.sidebar.toggleMenu")}
          >
            <MenuIcon />
          </button>
          <Link href="/admin/dashboard" className="flex items-center gap-2" onClick={closeNav}>
            <Logo />
            <span className="text-xs font-medium text-dark-6 dark:text-dark-6">{t("admin.title")}</span>
          </Link>
        </div>
      )}

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 min-[850px]:hidden"
          onClick={closeNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark",
          isMobile
            ? "fixed left-0 top-0 z-50 h-screen w-64 pt-14 transition-transform duration-200 min-[850px]:relative min-[850px]:pt-0"
            : "sticky top-0 h-screen w-64",
          isMobile && !isOpen && "-translate-x-full min-[850px]:translate-x-0"
        )}
        aria-label={t("admin.sidebar.ariaNav")}
        aria-hidden={isMobile && !isOpen}
      >
        <div className="flex flex-col gap-6 p-4">
          {!isMobile && (
            <Link href="/admin/dashboard" className="flex items-center gap-2 px-2">
              <Logo />
              <span className="text-xs font-medium text-dark-6 dark:text-dark-6">{t("admin.title")}</span>
            </Link>
          )}

          <nav className="flex flex-1 flex-col gap-1">
            {ADMIN_NAV_KEYS.map((item) => (
              <NavLink
                key={item.url}
                href={item.url}
                isActive={pathname === item.url}
                icon={item.icon}
                onNavigate={isMobile ? closeNav : undefined}
              >
                {t(`admin.sidebar.${item.key}`)}
              </NavLink>
            ))}
          </nav>

          <Link
            href="/"
            onClick={isMobile ? closeNav : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dark-6 hover:bg-gray-2 dark:hover:bg-dark-2"
          >
            <ArrowLeftIcon className="size-5" />
            {t("admin.backToApp")}
          </Link>
        </div>
      </aside>
    </div>
  );
}
