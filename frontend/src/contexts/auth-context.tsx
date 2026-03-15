"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { api, apiPost, apiPatch, apiGetWithOfflineCache } from "@/lib/api-client";
import { CACHE_KEYS } from "@/lib/offline-cache";

export interface Business {
  businessId: string;
  role?: string;
  name?: string;
}

export type AuthUser = {
  id: string;
  phone?: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: "admin" | "user";
};

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  businessId: string | null;
  businesses: Business[];
  isAdmin: boolean;
  setToken: (t: string | null) => void;
  setBusinessId: (id: string | null) => void;
  updateUserPreferences: (prefs: { defaultBusinessId?: string }) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  sendVoiceOtp: (phone: string, locale?: "en" | "fr") => Promise<{ success: boolean; message: string }>;
  login: (phone: string, otp?: string, password?: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signUpRequest: (email: string) => Promise<{ success: boolean; message: string }>;
  signUpVerify: (email: string, code: string, password: string) => Promise<void>;
  inviteRequestOtp: (token: string) => Promise<{ success: boolean; message: string }>;
  inviteVerify: (token: string, emailOrPhone: string, code: string, password: string) => Promise<void>;
  completeOAuth: (token: string) => Promise<void>;
  checkAuthFromCookie: () => Promise<boolean>;
  logout: () => void;
  refreshBusinesses: () => Promise<void>;
  isLoading: boolean;
}

function decodeJwt(token: string): { sub?: string; email?: string; name?: string; picture?: string; role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function decodeJwtRole(token: string): "admin" | "user" | null {
  const payload = decodeJwt(token);
  if (!payload) return null;
  return payload.role === "admin" ? "admin" : "user";
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "qb_auth_token";
const BUSINESS_KEY = "qb_business_id";
const USER_KEY = "qb_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (typeof window !== "undefined") {
      t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const setBusinessId = useCallback((id: string | null) => {
    setBusinessIdState(id);
    if (typeof window !== "undefined") {
      id ? localStorage.setItem(BUSINESS_KEY, id) : localStorage.removeItem(BUSINESS_KEY);
    }
  }, []);

  const updateUserPreferences = useCallback(
    async (prefs: { defaultBusinessId?: string }) => {
      const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      if (!t) return;
      const res = await apiPatch<{ success: boolean; data?: Record<string, unknown> }>(
        "/api/v1/users/me/preferences",
        prefs,
        { token: t }
      );
      if (!res?.success) throw new Error("Failed to update preferences");
    },
    []
  );

  const sendOtp = useCallback(async (phone: string) => {
    const res = await apiPost<{ success: boolean; message: string }>(
      "/api/v1/auth/send-otp",
      { phone },
      { skip401Redirect: true }
    );
    return res as { success: boolean; message: string };
  }, []);

  const sendVoiceOtp = useCallback(async (phone: string, locale?: "en" | "fr") => {
    const res = await apiPost<{ success: boolean; message: string }>(
      "/api/v1/auth/send-voice-otp",
      { phone, locale: locale ?? "en" },
      { skip401Redirect: true }
    );
    return res as { success: boolean; message: string };
  }, []);

  const refreshBusinesses = useCallback(async () => {
    const t = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!t) {
      setBusinesses([]);
      return;
    }
    try {
      const res = await apiGetWithOfflineCache<Business[]>(
        "/api/v1/access/businesses",
        `${CACHE_KEYS.BUSINESSES}:user`,
        { token: t }
      );
      const list = Array.isArray(res.data) ? res.data : [];
      setBusinesses(list);
      const stored = typeof window !== "undefined" ? localStorage.getItem(BUSINESS_KEY) : null;
      if (list.length && !stored) {
        setBusinessIdState(list[0].businessId);
        localStorage.setItem(BUSINESS_KEY, list[0].businessId);
      } else if (list.length && stored && list.some((b) => b.businessId === stored)) {
        setBusinessIdState(stored);
      }
    } catch {
      setBusinesses([]);
    }
  }, []);

  const login = useCallback(async (phone: string, otp?: string, password?: string) => {
    const body = password ? { phone, password } : { phone, otp };
    const res = await apiPost<{
      success: boolean;
      data?: { accessToken: string; user: AuthUser };
      accessToken?: string;
      user?: AuthUser;
    }>("/api/v1/auth/login", body, { skip401Redirect: true });

    const accessToken = res.accessToken ?? (res as { data?: { accessToken: string } }).data?.accessToken;
    const userData = res.user ?? (res as { data?: { user: AuthUser } }).data?.user;
    if (!accessToken || !userData) throw new Error("Invalid login response");

    setTokenState(accessToken);
    setUserState(userData);
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    }
    await refreshBusinesses();
  }, [refreshBusinesses]);

  const checkAuthFromCookie = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.get<{ user: AuthUser; businesses: Business[] }>(
        "/api/v1/auth/me",
        { skip401Redirect: true }
      );
      const data = res?.data;
      if (!data?.user || !Array.isArray(data.businesses)) return false;
      setUserState(data.user);
      setBusinesses(data.businesses);
      if (data.businesses.length) {
        const stored = typeof window !== "undefined" ? localStorage.getItem(BUSINESS_KEY) : null;
        const first = data.businesses[0].businessId;
        if (!stored || !data.businesses.some((b: Business) => b.businessId === stored)) {
          setBusinessIdState(first);
          if (typeof window !== "undefined") localStorage.setItem(BUSINESS_KEY, first);
        } else {
          setBusinessIdState(stored);
        }
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const applyAuthResult = useCallback(
    async (accessToken: string, userData: AuthUser) => {
      setTokenState(accessToken);
      setUserState(userData);
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
      await refreshBusinesses();
    },
    [refreshBusinesses]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<{
        accessToken?: string;
        user?: AuthUser;
      }>("/api/v1/auth/login/email", { email, password }, { skip401Redirect: true });

      const accessToken = res.accessToken ?? (res as { data?: { accessToken: string } }).data?.accessToken;
      const userData = res.user ?? (res as { data?: { user: AuthUser } }).data?.user;
      if (!accessToken || !userData) throw new Error("Invalid login response");

      await applyAuthResult(accessToken, userData);
    },
    [applyAuthResult]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<{
        accessToken?: string;
        user?: AuthUser;
      }>("/api/v1/auth/sign-up", { email, password }, { skip401Redirect: true });

      const accessToken = res.accessToken ?? (res as { data?: { accessToken: string } }).data?.accessToken;
      const userData = res.user ?? (res as { data?: { user: AuthUser } }).data?.user;
      if (!accessToken || !userData) throw new Error("Invalid sign-up response");

      await applyAuthResult(accessToken, userData);
    },
    [applyAuthResult]
  );

  const signUpRequest = useCallback(async (email: string) => {
    const res = await apiPost<{ success: boolean; message: string }>(
      "/api/v1/auth/sign-up/request",
      { email },
      { skip401Redirect: true }
    );
    return res as { success: boolean; message: string };
  }, []);

  const signUpVerify = useCallback(
    async (email: string, code: string, password: string) => {
      const res = await apiPost<{
        accessToken?: string;
        user?: AuthUser;
      }>("/api/v1/auth/sign-up/verify", { email, code, password }, { skip401Redirect: true });

      const accessToken = res.accessToken ?? (res as { data?: { accessToken: string } }).data?.accessToken;
      const userData = res.user ?? (res as { data?: { user: AuthUser } }).data?.user;
      if (!accessToken || !userData) throw new Error("Invalid verification response");

      await applyAuthResult(accessToken, userData);
    },
    [applyAuthResult]
  );

  const inviteRequestOtp = useCallback(async (token: string) => {
    const res = await apiPost<{ success: boolean; message: string }>(
      "/api/v1/auth/invite/request-otp",
      { token },
      { skip401Redirect: true }
    );
    return res as { success: boolean; message: string };
  }, []);

  const inviteVerify = useCallback(
    async (token: string, emailOrPhone: string, code: string, password: string) => {
      const res = await apiPost<{
        accessToken?: string;
        user?: AuthUser;
      }>("/api/v1/auth/invite/verify", { token, emailOrPhone, code, password }, { skip401Redirect: true });

      const accessToken = res.accessToken ?? (res as { data?: { accessToken: string } }).data?.accessToken;
      const userData = res.user ?? (res as { data?: { user: AuthUser } }).data?.user;
      if (!accessToken || !userData) throw new Error("Invalid verification response");

      await applyAuthResult(accessToken, userData);
    },
    [applyAuthResult]
  );

  const completeOAuth = useCallback(
    async (accessToken: string) => {
      try {
        const parts = accessToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
          ) as { sub?: string; email?: string; name?: string; picture?: string; role?: string };
          const userData: AuthUser = {
            id: payload.sub ?? "unknown",
            email: payload.email,
            name: payload.name,
            picture: payload.picture,
            role: payload.role === "admin" ? "admin" : "user",
          };
          setTokenState(accessToken);
          setUserState(userData);
          if (typeof window !== "undefined") {
            localStorage.setItem(TOKEN_KEY, accessToken);
            localStorage.setItem(USER_KEY, JSON.stringify(userData));
          }
          await refreshBusinesses();
        }
      } catch {
        throw new Error("Invalid token");
      }
    },
    [refreshBusinesses]
  );

  const logout = useCallback(async () => {
    setTokenState(null);
    setUserState(null);
    setBusinessIdState(null);
    setBusinesses([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(BUSINESS_KEY);
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch { /* ignore */ }
      window.location.href = "/auth/sign-in";
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      const t = localStorage.getItem(TOKEN_KEY);
      const b = localStorage.getItem(BUSINESS_KEY);
      const u = localStorage.getItem(USER_KEY);

      const fromCookie = await checkAuthFromCookie();
      if (fromCookie) {
        setTokenState(null);
        setIsLoading(false);
        return;
      }

      // Re-read token in case completeOAuth stored it during OAuth callback (race)
      const effectiveToken = localStorage.getItem(TOKEN_KEY) ?? t;
      setTokenState(effectiveToken);
      setBusinessIdState(b);
      if (u) {
        try {
          const stored = JSON.parse(u) as AuthUser;
          if (effectiveToken) {
            const claims = decodeJwt(effectiveToken);
            if (claims) {
              stored.name = claims.name ?? stored.name;
              stored.picture = claims.picture ?? stored.picture;
            }
            localStorage.setItem(USER_KEY, JSON.stringify(stored));
          }
          setUserState(stored);
        } catch {
          setUserState(null);
        }
      } else if (effectiveToken) {
        const claims = decodeJwt(effectiveToken);
        if (claims) {
          const userData: AuthUser = {
            id: claims.sub ?? "unknown",
            email: claims.email,
            name: claims.name,
            picture: claims.picture,
            role: claims.role === "admin" ? "admin" : "user",
          };
          setUserState(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        }
      }
      if (effectiveToken) {
        refreshBusinesses().finally(() => setIsLoading(false));
      } else {
        const devId = process.env.NEXT_PUBLIC_DEMO_BUSINESS_ID;
        if (devId) {
          setBusinessIdState(devId);
          setBusinesses([{ businessId: devId }]);
        }
        setIsLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin =
    user?.role === "admin" ||
    (token ? decodeJwtRole(token) === "admin" : false);

  // Memoize the context value so consumers only re-render when something actually changes.
  // Without this, a new object is created every render → every useAuthOptional() consumer
  // re-renders → cascading infinite loops in hooks that have context values in their deps.
  const contextValue = useMemo(
    () => ({
      token,
      user,
      businessId,
      businesses,
      isAdmin,
      setToken,
      setBusinessId,
      updateUserPreferences,
      sendOtp,
      sendVoiceOtp,
      login,
      loginWithEmail,
      signUp,
      signUpRequest,
      signUpVerify,
      inviteRequestOtp,
      inviteVerify,
      completeOAuth,
      checkAuthFromCookie,
      logout,
      refreshBusinesses,
      isLoading,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, user, businessId, businesses, isAdmin, isLoading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useAuthOptional() {
  return useContext(AuthContext);
}
