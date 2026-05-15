import { apiUrl } from "@/lib/api-base";

/**
 * Browser-safe fetch for `/api/*` when the UI may be static (IPFS) and must call a remote API origin.
 * Surfaces non-JSON/HTML errors instead of hanging or throwing.
 */
export async function fetchApiJson<T>(pathWithQuery: string): Promise<
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; error: string }
> {
  const url = apiUrl(pathWithQuery);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      status: 0,
      error: `${msg}. Static/IPFS builds need NEXT_PUBLIC_API_BASE pointing at your Netlify deployment that serves /api.`,
    };
  }

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      status: res.status,
      error: `Expected JSON from ${url.slice(0, 80)}… got HTTP ${res.status} (${text.slice(0, 140).replace(/\s+/g, " ")}…). Set NEXT_PUBLIC_API_BASE if using a static export.`,
    };
  }

  return { ok: true, status: res.status, body: body as T };
}
