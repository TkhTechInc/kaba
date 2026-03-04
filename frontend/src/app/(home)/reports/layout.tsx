"use client";

import { PermissionGuard } from "@/components/Auth/PermissionGuard";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="reports:read" show403>
      {children}
    </PermissionGuard>
  );
}
