"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import Image from "next/image";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { CameraIcon } from "./_components/icons";
import { updateProfile } from "@/services/user.service";
import { usePreferences } from "@/hooks/use-preferences";

const DEFAULT_AVATAR = "/images/user/user-03.png";
const USER_KEY = "qb_auth_user";

export default function Page() {
  const { user, businesses, isLoading, token } = useAuth();
  const { preferences, setPreferences } = usePreferences(token);
  const router = useRouter();
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/auth/sign-in");
    }
    if (user) setName(user.name ?? "");
  }, [user, isLoading, router]);

  const avatarSrc =
    customPhoto ??
    (user?.picture && !avatarError ? user.picture : DEFAULT_AVATAR);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    if (e.target.name === "profilePhoto") {
      setCustomPhoto(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateProfile({ name: name.trim() || undefined }, token, user.name);
      const stored = typeof window !== "undefined" ? localStorage.getItem(USER_KEY) : null;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          localStorage.setItem(USER_KEY, JSON.stringify({ ...parsed, name: updated.name }));
        } catch {
          // ignore parse errors
        }
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const displayName = user.name ?? user.phone ?? user.email ?? user.id;
  const roleLabel = user.role === "admin" ? "Administrator" : "Member";

  return (
    <div className="mx-auto w-full max-w-[970px]">
      <Breadcrumb pageName="Profile" />

      <div className="overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
        <div className="px-4 pb-6 pt-8 text-center lg:pb-8 lg:pt-10 xl:pb-11.5">
          <div className="relative z-10 mx-auto h-30 w-30 shrink-0 overflow-hidden rounded-full bg-white/20 p-1 backdrop-blur sm:h-44 sm:w-44 sm:p-3">
            <div className="relative h-full w-full overflow-hidden rounded-full drop-shadow-2">
              {avatarSrc && (
                <>
                  <Image
                    src={avatarSrc}
                    fill
                    sizes="(max-width: 640px) 120px, 176px"
                    className="object-cover object-center"
                    alt="Profile"
                    unoptimized={!!user?.picture && avatarSrc.startsWith("http")}
                    onError={() => setAvatarError(true)}
                  />
                  <label
                    htmlFor="profilePhoto"
                    className="absolute bottom-0 right-0 flex size-8.5 cursor-pointer items-center justify-center rounded-full bg-primary text-white hover:bg-opacity-90 sm:bottom-2 sm:right-2"
                  >
                    <CameraIcon />
                    <input
                      type="file"
                      name="profilePhoto"
                      id="profilePhoto"
                      className="sr-only"
                      onChange={handlePhotoChange}
                      accept="image/png, image/jpg, image/jpeg"
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="mb-1 text-heading-6 font-bold text-dark dark:text-white">
              {displayName}
            </h3>
            <p className="font-medium text-dark-4 dark:text-dark-6">{roleLabel}</p>

            <div className="mx-auto mb-5.5 mt-5 grid max-w-[280px] grid-cols-1 rounded-[5px] border border-stroke py-[9px] shadow-1 dark:border-dark-3 dark:bg-dark-2 dark:shadow-card sm:grid-cols-2">
              <div className="flex flex-col items-center justify-center gap-1 border-b border-stroke px-4 py-3 dark:border-dark-3 sm:border-b-0 sm:border-r">
                <span className="font-medium text-dark dark:text-white">
                  {businesses.length}
                </span>
                <span className="text-body-sm">Business{businesses.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-1 px-4 py-3">
                <span className="font-medium text-dark dark:text-white">
                  {user.phone ? "Phone" : user.email ? "Email" : "—"}
                </span>
                <span className="text-body-sm">Sign-in method</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-stroke bg-white p-6 shadow-sm dark:border-dark-3 dark:bg-gray-dark">
        <h2 className="mb-5 text-lg font-semibold text-dark dark:text-white">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            />
          </div>

          {user.email && (
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Email{" "}
                <span className="text-xs text-dark-4 dark:text-dark-6">(read-only)</span>
              </label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="w-full rounded-lg border border-stroke bg-gray-2 px-4 py-3 text-dark-4 outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              />
            </div>
          )}

          {user.phone && (
            <div>
              <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
                Phone{" "}
                <span className="text-xs text-dark-4 dark:text-dark-6">(read-only)</span>
              </label>
              <input
                type="text"
                value={user.phone}
                readOnly
                className="w-full rounded-lg border border-stroke bg-gray-2 px-4 py-3 text-dark-4 outline-none dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
              Preferred language
            </label>
            <select
              value={preferences.locale}
              onChange={(e) =>
                setPreferences({ locale: e.target.value as "en" | "fr" })
              }
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
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
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            >
              <option value="Africa/Lagos">West Africa (Lagos)</option>
              <option value="Africa/Accra">West Africa (Accra)</option>
              <option value="Africa/Cotonou">Benin (Cotonou)</option>
              <option value="Africa/Abidjan">Côte d&apos;Ivoire (Abidjan)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Profile updated successfully.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-stroke px-6 py-2.5 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
