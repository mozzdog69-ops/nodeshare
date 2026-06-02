import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import {
  bidDeploymentMismatchUserMessage,
  compareBidToDeployment,
} from "@/lib/akash/bid-deployment-alignment";
import { fetchLeaseProviderBidLcd } from "@/lib/akash/fetch-deployment-bids";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { fetchDeploymentRowLcd } from "@/lib/akash/recover-manifest-json";

export type AkashLeaseInfo = {
  provider: string;
  state: string;
  reason: string;
  gseq: number;
  oseq: number;
};

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

function parseLeaseRow(row: {
  lease?: {
    id?: { provider?: string; gseq?: number; oseq?: number };
    state?: string;
    reason?: string;
  };
  id?: { provider?: string; gseq?: number; oseq?: number; state?: string };
}): AkashLeaseInfo | null {
  const lease = row.lease ?? row;
  const id = (lease as { id?: { provider?: string; gseq?: number; oseq?: number } }).id ?? lease;
  const provider = sanitizeAkashAddress((id as { provider?: string }).provider);
  if (!provider) return null;
  return {
    provider,
    state: String((lease as { state?: string }).state ?? (id as { state?: string }).state ?? "")
      .trim()
      .toLowerCase(),
    reason: String((lease as { reason?: string }).reason ?? "").trim().toLowerCase(),
    gseq: Number((id as { gseq?: number }).gseq ?? 1),
    oseq: Number((id as { oseq?: number }).oseq ?? 1),
  };
}

/** Latest lease row for a deployment (prefers active over closed). */
export async function fetchLeaseInfoLcd(owner: string, dseq: number): Promise<AkashLeaseInfo | null> {
  const qs = new URLSearchParams({
    "filters.owner": owner,
    "filters.dseq": String(dseq),
    "pagination.limit": "10",
  });

  for (const base of lcdBases()) {
    const url = `${base}/akash/market/v1beta5/leases/list?${qs}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        leases?: {
          lease?: {
            id?: { provider?: string; gseq?: number; oseq?: number };
            state?: string;
            reason?: string;
          };
        }[];
      };
      const parsed = (json.leases ?? [])
        .map((row) => parseLeaseRow(row))
        .filter((row): row is AkashLeaseInfo => row != null);
      if (!parsed.length) continue;
      return parsed.find((row) => row.state === "active") ?? parsed[0] ?? null;
    } catch {
      /* next LCD */
    }
  }
  return null;
}

export function leaseManifestRetryBlockedReason(lease: AkashLeaseInfo | null): string | null {
  if (!lease) {
    return "No lease found for this deployment. Close it on Stuck orders to recover ACT, then rent again.";
  }
  if (lease.state === "active") return null;
  if (lease.reason.includes("manifest_timeout")) {
    return (
      "This lease expired because the manifest was not delivered in time. Retry manifest will not work. " +
      "Close the deployment on Stuck orders to recover remaining ACT, then rent again."
    );
  }
  return "This lease is closed on-chain. Close the deployment on Stuck orders to recover ACT, then rent again.";
}

export type ManifestRetryEligibility = {
  canRetryManifest: boolean;
  retryBlockedReason?: string;
  lease: AkashLeaseInfo | null;
};

/** Whether manifest retry can succeed (active lease + bid matches deployment). */
export async function fetchManifestRetryEligibility(
  owner: string,
  dseq: number,
): Promise<ManifestRetryEligibility> {
  const lease = await fetchLeaseInfoLcd(owner, dseq);
  const leaseBlocked = leaseManifestRetryBlockedReason(lease);
  if (leaseBlocked) {
    return { canRetryManifest: false, retryBlockedReason: leaseBlocked, lease };
  }

  const depRow = await fetchDeploymentRowLcd(owner, dseq);
  const provider = lease?.provider;
  if (depRow && provider) {
    const leaseBid = await fetchLeaseProviderBidLcd(owner, dseq, provider);
    const alignment = compareBidToDeployment(depRow, leaseBid?.resources ?? null);
    if (alignment && !alignment.aligned) {
      return {
        canRetryManifest: false,
        retryBlockedReason: bidDeploymentMismatchUserMessage(alignment),
        lease,
      };
    }
  }

  return { canRetryManifest: true, lease };
}

export function isBidDeploymentMismatchMessage(message: string): boolean {
  return /provider's bid does not match|bid does not match what you deployed|any nvidia.*locked to/i.test(
    message,
  );
}
