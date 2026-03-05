"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import { useAuth } from "@/contexts/auth-context";
import { useFeatures } from "@/hooks/use-features";
import { UpgradePrompt } from "@/components/UpgradePrompt";

export default function LedgerBalancePage() {
  const { businessId } = useAuth();
  const features = useFeatures(businessId);

  if (!businessId) {
    return (
      <>
        <Breadcrumb pageName="Ledger Balance" />
        <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
          <p className="text-dark-6">Select a business to view ledger balance.</p>
        </div>
      </>
    );
  }

  if (features.loading) {
    return (
      <>
        <Breadcrumb pageName="Ledger Balance" />
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-stroke bg-white dark:border-dark-3 dark:bg-gray-dark">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </>
    );
  }

  if (!features.isEnabled("ledger")) {
    return (
      <>
        <Breadcrumb pageName="Ledger Balance" />
        <UpgradePrompt feature="Ledger" />
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Ledger Balance" />
      <div className="rounded-lg border border-stroke bg-white p-6 dark:border-dark-3 dark:bg-gray-dark">
        <h1 className="mb-4 text-heading-4 font-bold text-dark dark:text-white">
          Ledger Balance
        </h1>
        <p className="text-dark-4 dark:text-dark-6">
          View current balance for your business.
        </p>
      </div>
    </>
  );
}
