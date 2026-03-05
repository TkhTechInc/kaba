"use client";

import { useAuth } from "@/contexts/auth-context";
import { usePreferences } from "@/hooks/use-preferences";
import Link from "next/link";

export default function PreferencesPage() {
  const { token } = useAuth();
  const { preferences, setPreferences, loading, error } = usePreferences(token);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-dark-4 dark:text-dark-6">
        <Link href="/settings" className="hover:text-primary">
          Settings
        </Link>
        <span>/</span>
        <span className="text-dark dark:text-white">Preferences</span>
      </div>

      <h1 className="mb-2 text-heading-4 font-bold text-dark dark:text-white">
        Preferences
      </h1>
      <p className="mb-6 text-sm text-dark-4 dark:text-dark-6">
        Manage your notification and display preferences. Synced across all your devices.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
      <>
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
          Notifications
        </h2>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block font-medium text-dark dark:text-white">
                Email notifications
              </span>
              <span className="text-sm text-dark-4 dark:text-dark-6">
                Receive invoices, payments, and reminders by email
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) =>
                setPreferences({ emailNotifications: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block font-medium text-dark dark:text-white">
                In-app notifications
              </span>
              <span className="text-sm text-dark-4 dark:text-dark-6">
                Show notifications when you&apos;re in the app
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.inAppNotifications}
              onChange={(e) =>
                setPreferences({ inAppNotifications: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block font-medium text-dark dark:text-white">
                SMS reminders
              </span>
              <span className="text-sm text-dark-4 dark:text-dark-6">
                Receive payment reminders by SMS (may incur charges)
              </span>
            </div>
            <input
              type="checkbox"
              checked={preferences.smsReminders}
              onChange={(e) =>
                setPreferences({ smsReminders: e.target.checked })
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-dark">
        <h2 className="mb-4 text-lg font-semibold text-dark dark:text-white">
          Display
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Language
            </label>
            <select
              value={preferences.locale}
              onChange={(e) =>
                setPreferences({ locale: e.target.value as "en" | "fr" })
              }
              className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => setPreferences({ timezone: e.target.value })}
              className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-dark outline-none focus:border-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="Africa/Lagos">West Africa (Lagos)</option>
              <option value="Africa/Accra">West Africa (Accra)</option>
              <option value="Africa/Cotonou">Benin (Cotonou)</option>
              <option value="Africa/Abidjan">Côte d&apos;Ivoire (Abidjan)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
