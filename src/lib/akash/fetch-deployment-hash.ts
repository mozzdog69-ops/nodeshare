import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

/** On-chain manifest hash for a deployment (base64). */
export async function fetchDeploymentHashLcd(owner: string, dseq: number): Promise<string | null> {
  const addr = sanitizeAkashAddress(owner);
  if (!addr || !dseq) return null;

  const qs = new URLSearchParams({
    "filters.owner": addr,
    "pagination.limit": "50",
  });

  for (const base of lcdBases()) {
    const url = `${base}/akash/deployment/v1beta4/deployments/list?${qs}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        deployments?: {
          deployment?: { id?: { dseq?: string | number }; hash?: string };
        }[];
      };
      const row = (json.deployments ?? []).find(
        (entry) => String(entry.deployment?.id?.dseq ?? "") === String(dseq),
      );
      const hash = String(row?.deployment?.hash ?? "").trim();
      if (hash) return hash;
    } catch {
      /* next LCD */
    }
  }
  return null;
}
