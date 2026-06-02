/** Production Render proxy — override stale localhost baked into old Netlify builds. */
export const DEFAULT_AKASH_PROVIDER_PROXY_WS =
  "wss://nodeshare-akash-proxy.onrender.com";

export function normalizeProxyWsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice(8)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice(7)}`;
  if (trimmed.startsWith("wss://") || trimmed.startsWith("ws://")) return trimmed;
  return `wss://${trimmed}`;
}

export function isLocalhostProxyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function proxyHttpBaseUrl(proxyWs: string): string {
  return proxyWs.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:").replace(/\/$/, "");
}

/** Poll Render /health until awake (free tier cold start ~30–90s). */
export async function wakeAkashProviderProxy(
  proxyWs: string,
  onStatus?: (message: string) => void,
): Promise<boolean> {
  const healthUrl = `${proxyHttpBaseUrl(proxyWs)}/health`;
  for (let attempt = 1; attempt <= 18; attempt++) {
    onStatus?.(`Waking proxy (${attempt}/18)…`);
    try {
      const res = await fetch(healthUrl, { cache: "no-store", mode: "cors" });
      if (res.ok) return true;
    } catch {
      /* still spinning up */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  return false;
}

/** Resolve proxy WS URL from env strings; never return localhost on public deploys. */
export function resolveProxyWsFromEnv(raw: string, siteHost?: string): string {
  const normalized = normalizeProxyWsUrl(raw);
  const host = siteHost?.toLowerCase() ?? "";
  const isPublicSite =
    host.endsWith(".netlify.app") ||
    host.includes("nodeshare") ||
    (host && host !== "localhost" && host !== "127.0.0.1");

  if (normalized && !(isLocalhostProxyUrl(normalized) && isPublicSite)) {
    return normalized;
  }
  if (isPublicSite || !normalized) {
    return DEFAULT_AKASH_PROVIDER_PROXY_WS;
  }
  return normalized;
}
