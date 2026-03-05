import { apiGet, apiPatch } from "@/lib/api-client";
import { offlineMutation } from "@/lib/offline-api";
import { getCached, setCached, CACHE_KEYS } from "@/lib/offline-cache";

export interface UpdateProfileInput {
  name?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  role?: string;
}

export interface UserPreferences {
  locale?: "en" | "fr";
  timezone?: string;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  smsReminders?: boolean;
}

export async function getPreferences(token: string): Promise<UserPreferences> {
  if (typeof window !== "undefined" && !navigator.onLine) {
    const cached = await getCached<UserPreferences>(CACHE_KEYS.PREFERENCES);
    return cached ?? {};
  }
  const res = await apiGet<{ success: boolean; data: UserPreferences }>(
    "/api/v1/users/me/preferences",
    { token }
  );
  const data = (res as { success: boolean; data: UserPreferences }).data ?? {};
  if (typeof window !== "undefined" && data && Object.keys(data).length > 0) {
    setCached(CACHE_KEYS.PREFERENCES, data).catch(() => {});
  }
  return data;
}

export async function updatePreferences(
  input: Partial<UserPreferences>,
  token: string | null,
  currentPreferences?: UserPreferences
): Promise<UserPreferences> {
  const optimistic = { ...(currentPreferences ?? {}), ...input };
  const result = await offlineMutation<{ success: boolean; data: UserPreferences }>(
    "/api/v1/users/me/preferences",
    "PATCH",
    input,
    token,
    { success: true, data: optimistic }
  );
  const data = result.data?.data ?? optimistic;
  if (typeof window !== "undefined" && data) {
    setCached(CACHE_KEYS.PREFERENCES, data).catch(() => {});
  }
  return data;
}

export async function updateProfile(
  input: UpdateProfileInput,
  token: string | null,
  currentName?: string
): Promise<UserProfile> {
  const optimistic = { id: "", name: currentName ?? input.name, email: undefined, phone: undefined, role: undefined };
  const result = await offlineMutation<{ success: boolean; data: UserProfile }>(
    "/api/v1/users/me",
    "PATCH",
    input,
    token,
    { success: true, data: { ...optimistic, name: input.name ?? currentName } }
  );
  return (result.data as { success: boolean; data: UserProfile })?.data ?? optimistic;
}
