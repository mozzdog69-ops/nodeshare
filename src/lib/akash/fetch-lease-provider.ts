import { fetchLeaseInfoLcd } from "@/lib/akash/fetch-lease-info";

/** Active lease provider for a deployment (LCD REST). */
export async function fetchLeaseProviderLcd(owner: string, dseq: number): Promise<string> {
  const info = await fetchLeaseInfoLcd(owner, dseq);
  if (!info) return "";
  if (info.state === "active") return info.provider;
  return "";
}

export {
  fetchLeaseInfoLcd,
  fetchManifestRetryEligibility,
  leaseManifestRetryBlockedReason,
} from "@/lib/akash/fetch-lease-info";
