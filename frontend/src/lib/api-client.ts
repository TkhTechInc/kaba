/**
 * API client for Kaba backend.
 * Base URL from NEXT_PUBLIC_API_URL. Supports Bearer token and X-API-Key auth.
 */

import { getCached, setCached } from "@/lib/offline-cache";

/** Typed error thrown for non-2xx responses. Check `status` to distinguish 403 from others. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type ApiClientOptions = {
  /** Bearer token for auth (from auth context) */
  token?: string | null;
  /** API key for server-side or API key auth */
  apiKey?: string | null;
  /** Skip 401 redirect (e.g. when calling from server) */
  skip401Redirect?: boolean;
};

export type RequestConfig = RequestInit & ApiClientOptions;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

async function handleResponse<T>(
  res: Response,
  skip401Redirect?: boolean
): Promise<T> {
  if (res.status === 401 && typeof window !== "undefined" && !skip401Redirect) {
    // Clear auth so sign-in page doesn't redirect back to dashboard (prevents flicker loop)
    localStorage.removeItem("qb_auth_token");
    localStorage.removeItem("qb_auth_user");
    localStorage.removeItem("qb_business_id");
    // Call logout to clear HttpOnly cookie
    const baseUrl = getBaseUrl();
    fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    window.location.href = "/auth/sign-in";
    throw new ApiError("Unauthorized", 401);
  }

  const contentType = res.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const text = await res.text();

  if (!res.ok) {
    let message: string;
    try {
      const json = JSON.parse(text);
      const raw = json.message ?? json.error ?? text;
      if (typeof raw === "string") {
        message = raw;
      } else if (Array.isArray(raw)) {
        message = raw.map((m: unknown) => (typeof m === "string" ? m : String(m))).join(". ") || text || res.statusText;
      } else if (raw && typeof raw === "object") {
        const obj = raw as Record<string, unknown>;
        const msg = obj.message ?? obj.error ?? obj.msg ?? obj.en;
        message = typeof msg === "string" ? msg : JSON.stringify(raw);
      } else {
        message = text || res.statusText;
      }
    } catch {
      message = text || res.statusText;
    }
    throw new ApiError(message || `Request failed: ${res.status}`, res.status);
  }

  if (isJson && text) {
    return JSON.parse(text) as T;
  }
  return text as unknown as T;
}

function buildHeaders(options: RequestConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(typeof options.headers === "object" &&
    !(options.headers instanceof Headers)
      ? (Object.fromEntries(
          Object.entries(options.headers).map(([k, v]) => [k, String(v)])
        ) as Record<string, string>)
      : {}),
  };

  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  if (options.apiKey) {
    headers["X-API-Key"] = options.apiKey;
  }

  return headers;
}

function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestConfig = {}
): Promise<T> {
  const { token, apiKey, skip401Redirect, ...init } = options;
  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path}`;
  return fetch(url, {
    method,
    credentials: "include",
    headers: buildHeaders({ token, apiKey, headers: init.headers }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  }).then((res) => handleResponse<T>(res, skip401Redirect));
}

export async function apiGet<T = unknown>(
  path: string,
  options: RequestConfig = {}
): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export type ApiGetWithOfflineCacheOptions = RequestConfig & {
  params?: Record<string, string>;
};

/**
 * GET request with offline cache. When offline, returns cached data if available.
 * When online, fetches and caches on success. On network error, falls back to cache.
 */
export async function apiGetWithOfflineCache<T>(
  path: string,
  cacheKey: string,
  options: ApiGetWithOfflineCacheOptions = {}
): Promise<ApiResponse<T>> {
  const { params, ...rest } = options;
  const fullPath =
    params && Object.keys(params).length > 0
      ? `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(
          Object.fromEntries(
            Object.entries(params).filter(
              ([, v]) => v !== undefined && v !== ""
            )
          )
        ).toString()}`
      : path;

  const isOffline =
    typeof window !== "undefined" && navigator && !navigator.onLine;

  if (isOffline) {
    const cached = await getCached<ApiResponse<T>>(cacheKey);
    if (cached) return cached;
    throw new Error("Offline and no cached data");
  }

  try {
    const res = await request<ApiResponse<T>>(
      "GET",
      fullPath,
      undefined,
      rest
    );
    if (res && typeof res === "object") {
      await setCached(cacheKey, res as ApiResponse<T>);
    }
    return res as ApiResponse<T>;
  } catch (e) {
    const cached = await getCached<ApiResponse<T>>(cacheKey);
    if (cached) return cached;
    throw e;
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestConfig = {}
): Promise<T> {
  return request<T>("POST", path, body, options);
}

export async function apiPut<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestConfig = {}
): Promise<T> {
  return request<T>("PUT", path, body, options);
}

export async function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
  options: RequestConfig = {}
): Promise<T> {
  return request<T>("PATCH", path, body, options);
}

export async function apiDelete<T = unknown>(
  path: string,
  options: RequestConfig = {}
): Promise<T> {
  return request<T>("DELETE", path, undefined, options);
}

/** Legacy api object for backward compatibility */
export const api = {
  get<T>(path: string, opts?: { token?: string; params?: Record<string, string> }) {
    const url = opts?.params
      ? `${path}${path.includes("?") ? "&" : "?"}${new URLSearchParams(
          Object.fromEntries(
            Object.entries(opts.params).filter(
              ([, v]) => v !== undefined && v !== ""
            )
          )
        ).toString()}`
      : path;
    return apiGet<ApiResponse<T>>(url, {
      token: opts?.token ?? undefined,
      skip401Redirect: false,
    });
  },
  post<T>(path: string, body?: unknown, opts?: { token?: string }) {
    return apiPost<ApiResponse<T>>(path, body, {
      token: opts?.token ?? undefined,
      skip401Redirect: false,
    });
  },
  put<T>(path: string, body?: unknown, opts?: { token?: string }) {
    return apiPut<ApiResponse<T>>(path, body, {
      token: opts?.token ?? undefined,
      skip401Redirect: false,
    });
  },
  patch<T>(path: string, body?: unknown, opts?: { token?: string }) {
    return apiPatch<ApiResponse<T>>(path, body, {
      token: opts?.token ?? undefined,
      skip401Redirect: false,
    });
  },
  delete<T>(path: string, opts?: { token?: string }) {
    return apiDelete<ApiResponse<T>>(path, {
      token: opts?.token ?? undefined,
      skip401Redirect: false,
    });
  },
};
