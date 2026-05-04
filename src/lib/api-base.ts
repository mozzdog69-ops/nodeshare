/**
 * Optional split deploy: static site on IPFS calls APIs on another origin.
 * Set NEXT_PUBLIC_API_BASE=https://api.yourdomain.com (no trailing slash).
 */
export function apiUrl(pathWithQuery: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");
  const path = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;
  if (!base) return path;
  return `${base}${path}`;
}
