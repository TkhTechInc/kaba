/**
 * API base URL for backend. Use NEXT_PUBLIC_API_URL in production.
 * Default: http://localhost:3001 (NestJS backend)
 */
const getApiBase = () =>
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function apiUrl(path: string): string {
  const base = getApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
