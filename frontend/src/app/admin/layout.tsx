"use client";

import { AdminGuard } from "@/components/Auth/AdminGuard";
import { AdminSidebar } from "@/components/Layouts/admin-sidebar";
import type { PropsWithChildren } from "react";

export default function AdminLayout({ children }: PropsWithChildren) {
  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 bg-gray-2 dark:bg-[#020d1a]">
          <main className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
