import type { LeasedAkashDeployment } from "@/lib/akash/fetch-lcd-stuck-deployments";
import type { GpuJob } from "@/lib/gpu/types";

/** Active lease + escrow locked is normal while renting — only list recoverable cases on Stuck orders. */
export function leasedDeploymentNeedsRecovery(
  dseq: number,
  jobs: GpuJob[],
): boolean {
  const job = jobs.find((j) => j.dseq === dseq);
  if (!job) return false;

  const providerStatus = String(job.provider_status || "").toLowerCase();
  const internal = String(job.internal_status || "").toLowerCase();

  if (providerStatus === "manifest_failed") return true;
  if (internal === "manifest_failed") return true;
  if (/manifest upload|manifest version|hash mismatch/i.test(String(job.error_message || ""))) {
    return true;
  }

  if (["running", "lease_active", "delivered", "completed"].includes(internal)) {
    return false;
  }

  return internal === "failed" || internal === "bid_timeout";
}

export function filterRecoverableLeasedDeployments(
  leased: LeasedAkashDeployment[],
  jobs: GpuJob[],
): LeasedAkashDeployment[] {
  return leased.filter((row) => leasedDeploymentNeedsRecovery(row.dseq, jobs));
}
