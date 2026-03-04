"use client";

import { PermissionGuard } from "@/components/Auth/PermissionGuard";

export default function InvoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="invoices:read" show403>
      {children}
    </PermissionGuard>
  );
}
