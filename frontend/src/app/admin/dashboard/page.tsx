"use client";

import { useAuth } from "@/contexts/auth-context";
import { createAdminApi } from "@/services/admin.service";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminSummary } from "@/services/admin.service";

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    createAdminApi(token)
      .getSummary()
      .then((res) => res as unknown as AdminSummary)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  const cards = [
    {
      title: "Businesses",
      value: data?.businessesCount ?? 0,
      href: "/admin/businesses",
    },
    {
      title: "Ledger Entries",
      value: data?.ledgerEntriesCount ?? 0,
      href: "/admin/activity",
    },
    {
      title: "Invoices",
      value: data?.invoicesCount ?? 0,
      href: "/admin/metrics",
    },
    {
      title: "Recent Activity",
      value: data?.recentActivityCount ?? 0,
      href: "/admin/activity",
    },
    {
      title: "Debts",
      value: "—",
      href: "/admin/debts",
    },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-dark dark:text-white">
        Admin Dashboard
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-[10px] bg-white p-6 shadow-1 transition hover:shadow-md dark:bg-gray-dark dark:shadow-card dark:hover:shadow-lg"
          >
            <p className="text-sm font-medium text-dark-6 dark:text-dark-6">
              {card.title}
            </p>
            <p className="mt-2 text-2xl font-bold text-dark dark:text-white">
              {typeof card.value === "number"
                ? card.value.toLocaleString()
                : card.value}
            </p>
          </Link>
        ))}
      </div>
      {data?.timestamp && (
        <p className="mt-4 text-sm text-dark-6 dark:text-dark-6">
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
