"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const ADMIN_NAV = [
  { title: "Dashboard", url: "/admin/dashboard", icon: HomeIcon },
  { title: "Health", url: "/admin/health", icon: ShieldIcon },
  { title: "Receipts", url: "/admin/receipts", icon: ReceiptIcon },
  { title: "Metrics", url: "/admin/metrics", icon: PieChart },
  { title: "Usage", url: "/admin/usage", icon: ChartBarIcon },
  { title: "Activity", url: "/admin/activity", icon: Table },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: ReceiptIcon },
  { title: "Leakage Report", url: "/admin/leakage", icon: ShieldIcon },
  { title: "AI Query", url: "/admin/ai", icon: DocumentIcon },
  { title: "Businesses", url: "/admin/businesses", icon: Table },
  { title: "Debts", url: "/admin/debts", icon: ReceiptIcon },
  { title: "Users", url: "/admin/users", icon: DocumentIcon },
  { title: "Features", url: "/admin/features", icon: SettingsIcon },
];

function NavLink({
  href,
  isActive,
  icon: Icon,
  children,
}: {
  href: string;
  isActive: boolean;
  icon: React.ComponentType<IconProps>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
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

  return (
    <aside
      className="sticky top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark"
      aria-label="Admin navigation"
    >
      <div className="flex flex-col gap-6 p-4">
        <Link href="/admin/dashboard" className="flex items-center gap-2 px-2">
          <Logo />
          <span className="text-xs font-medium text-dark-6 dark:text-dark-6">
            Admin
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.url}
              href={item.url}
              isActive={pathname === item.url}
              icon={item.icon}
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dark-6 hover:bg-gray-2 dark:hover:bg-dark-2"
        >
          <ArrowLeftIcon className="size-5" />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
