"use client";

import { useAuthOptional } from "@/contexts/auth-context";
import type { Role } from "@/types/permissions";
import {
  roleHasPermission,
  FEATURE_PERMISSIONS,
  type Permission,
} from "@/types/permissions";
import { useMemo } from "react";

export interface PermissionsResult {
  role: Role | null;
  canRead: (permission: Permission) => boolean;
  canWrite: (permission: Permission) => boolean;
  /** Check if user has the given permission */
  hasPermission: (permission: Permission) => boolean;
  /** Convenience: canRead for ledger */
  ledger: { canRead: boolean; canWrite: boolean };
  /** Convenience: canRead/canWrite for invoices */
  invoices: { canRead: boolean; canWrite: boolean };
  /** Convenience: canRead/canWrite for reports */
  reports: { canRead: boolean; canWrite: boolean };
  /** Convenience: canRead/canWrite for receipts */
  receipts: { canRead: boolean; canWrite: boolean };
  /** Convenience: canRead for AI features */
  ai: { canRead: boolean };
  /** Convenience: canRead for tax */
  tax: { canRead: boolean };
  /** Convenience: canRead/canWrite for inventory */
  inventory: { canRead: boolean; canWrite: boolean };
  isLoading: boolean;
}

function parseRole(role: string | undefined): Role | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "owner" || r === "accountant" || r === "viewer") return r;
  return null;
}

export function usePermissions(businessId: string | null): PermissionsResult {
  const auth = useAuthOptional();
  const isLoading = auth?.isLoading ?? false;

  return useMemo(() => {
    const role = businessId
      ? parseRole(
          auth?.businesses?.find((b) => b.businessId === businessId)?.role
        )
      : null;

    const canRead = (permission: Permission) =>
      role !== null && roleHasPermission(role, permission);
    const canWrite = (permission: Permission) =>
      role !== null && roleHasPermission(role, permission);
    const hasPermission = (permission: Permission) =>
      role !== null && roleHasPermission(role, permission);

    return {
      role,
      canRead,
      canWrite,
      hasPermission,
      ledger: {
        canRead: canRead(FEATURE_PERMISSIONS.ledger.read),
        canWrite: canWrite(FEATURE_PERMISSIONS.ledger.write),
      },
      invoices: {
        canRead: canRead(FEATURE_PERMISSIONS.invoices.read),
        canWrite: canWrite(FEATURE_PERMISSIONS.invoices.write),
      },
      reports: {
        canRead: canRead(FEATURE_PERMISSIONS.reports.read),
        canWrite: canWrite(FEATURE_PERMISSIONS.reports.write),
      },
      receipts: {
        canRead: canRead(FEATURE_PERMISSIONS.receipts.read),
        canWrite: canWrite(FEATURE_PERMISSIONS.receipts.write),
      },
      ai: {
        canRead: canRead(FEATURE_PERMISSIONS.ai_query.read),
      },
      tax: {
        canRead: canRead(FEATURE_PERMISSIONS.tax.read),
      },
      inventory: {
        canRead: canRead(FEATURE_PERMISSIONS.inventory.read),
        canWrite: canWrite(FEATURE_PERMISSIONS.inventory.write),
      },
      isLoading,
    };
  }, [businessId, auth?.businesses, auth?.isLoading, isLoading]);
}
