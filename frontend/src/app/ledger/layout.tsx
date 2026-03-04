"use client";

import { PermissionGuard } from "@/components/Auth/PermissionGuard";

export default function LedgerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PermissionGuard permission="ledger:read" show403>
      {children}
    </PermissionGuard>
  );
}
