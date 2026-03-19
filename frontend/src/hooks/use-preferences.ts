"use client";

import { useState, useEffect, useCallback } from "react";
import { getPreferences, updatePreferences } from "@/services/user.service";
import type { UserPreferences } from "@/services/user.service";

export type Preferences = {
  locale: "en" | "fr";
  timezone: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  smsReminders: boolean;
  dailySummaryEnabled?: boolean;
};

const DEFAULT_PREFERENCES: Preferences = {
  locale: "en",
  timezone: "Africa/Lagos",
  emailNotifications: true,
  inAppNotifications: true,
  smsReminders: false,
  dailySummaryEnabled: false,
};

function mergeWithDefaults(server: Partial<UserPreferences> | null): Preferences {
  const tz =
    typeof Intl !== "undefined" && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "Africa/Lagos";
  return {
    ...DEFAULT_PREFERENCES,
    timezone: tz,
    ...(server && typeof server === "object" ? server : {}),
  };
}

export function usePreferences(token: string | null) {
  const [preferences, setPreferencesState] = useState<Preferences>(
    DEFAULT_PREFERENCES
  );
  const [loading, setLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setPreferencesState(mergeWithDefaults(null));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPreferences(token)
      .then((data) => {
        if (!cancelled) {
          setPreferencesState(mergeWithDefaults(data));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load preferences");
          setPreferencesState(mergeWithDefaults(null));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const setPreferences = useCallback(
    async (updates: Partial<Preferences>) => {
      const next = { ...preferences, ...updates };
      setPreferencesState(next);
      if (!token) return;
      try {
        setError(null);
        await updatePreferences(updates, token, preferences);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save preferences");
        setPreferencesState(preferences);
      }
    },
    [token, preferences]
  );

  return { preferences, setPreferences, loading, error };
}
