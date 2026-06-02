import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";

export async function fetchProviderHostUriLcd(provider: string): Promise<string> {
  const owner = sanitizeAkashAddress(provider);
  if (!owner) throw new Error("Invalid provider address.");

  const bases = (
    process.env.AKASH_LCD_URL?.trim()
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  for (const base of bases) {
    const url = `${base}/akash/provider/v1beta4/providers/${owner}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        provider?: { host_uri?: string; hostUri?: string };
      };
      const uri = String(json.provider?.host_uri ?? json.provider?.hostUri ?? "").trim();
      if (uri) return uri.replace(/\/$/, "");
    } catch {
      /* next LCD */
    }
  }

  throw new Error(`Provider ${owner.slice(0, 12)}… has no host URI on Akash LCD.`);
}
