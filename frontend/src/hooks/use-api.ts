"use client";

import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  type RequestConfig,
} from "@/lib/api-client";
import { useAuthOptional } from "@/contexts/auth-context";
import { useCallback, useMemo } from "react";

/**
 * Returns API methods with auth token from context pre-attached.
 * Use in client components that need to call the backend.
 */
export function useApi() {
  const auth = useAuthOptional();
  const token = auth?.token ?? null;

  const opts = useMemo(
    (): Pick<RequestConfig, "token"> => ({ token: token || undefined }),
    [token]
  );

  const get = useCallback(
    <T = unknown>(path: string, options?: Omit<RequestConfig, "token">) =>
      apiGet<T>(path, { ...opts, ...options }),
    [opts]
  );

  const post = useCallback(
    <T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<RequestConfig, "token">
    ) => apiPost<T>(path, body, { ...opts, ...options }),
    [opts]
  );

  const put = useCallback(
    <T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<RequestConfig, "token">
    ) => apiPut<T>(path, body, { ...opts, ...options }),
    [opts]
  );

  const patch = useCallback(
    <T = unknown>(
      path: string,
      body?: unknown,
      options?: Omit<RequestConfig, "token">
    ) => apiPatch<T>(path, body, { ...opts, ...options }),
    [opts]
  );

  const del = useCallback(
    <T = unknown>(path: string, options?: Omit<RequestConfig, "token">) =>
      apiDelete<T>(path, { ...opts, ...options }),
    [opts]
  );

  return useMemo(
    () => ({ get, post, put, patch, delete: del, token }),
    [get, post, put, patch, del, token]
  );
}
