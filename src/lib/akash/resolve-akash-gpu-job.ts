import {
  buildAkashLeaseJobId,
  parseAkashLeaseJobId,
  resolveProviderFromPrefix,
} from "@/lib/akash/akash-lease-job-id";
import { fetchLeaseInfoLcd } from "@/lib/akash/fetch-lease-info";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import type { GpuJob } from "@/lib/gpu/types";

export function collectProviderCandidates(jobs: GpuJob[]): string[] {
  const set = new Set<string>();
  for (const job of jobs) {
    const p = sanitizeAkashAddress(job.provider_owner || job.provider_id);
    if (p) set.add(p);
  }
  return [...set];
}

/** Resolve a direct Akash job id against local jobs + optional LCD rows. */
export async function resolveAkashGpuJob(input: {
  jobId: string;
  owner: string;
  localJobs: GpuJob[];
  chainJobs?: GpuJob[];
}): Promise<{
  job: GpuJob | null;
  dseq: number;
  provider: string;
  leaseState: string;
}> {
  const parsed = parseAkashLeaseJobId(input.jobId);
  if (!parsed) {
    return { job: null, dseq: 0, provider: "", leaseState: "" };
  }

  const all = [...input.localJobs, ...(input.chainJobs ?? [])];
  const byId = all.find((j) => j.id === input.jobId);
  const byDseq = all.find((j) => j.dseq === parsed.dseq);

  const candidates = collectProviderCandidates(all);
  const provider =
    sanitizeAkashAddress(byId?.provider_owner || byId?.provider_id) ||
    sanitizeAkashAddress(byDseq?.provider_owner || byDseq?.provider_id) ||
    resolveProviderFromPrefix(parsed.providerPrefix, candidates) ||
    "";

  const owner = sanitizeAkashAddress(input.owner);
  let leaseState =
    String(byId?.lease_state || byDseq?.lease_state || "").toLowerCase() || "";

  if (owner && parsed.dseq) {
    const lcd = await fetchLeaseInfoLcd(owner, parsed.dseq);
    if (lcd?.state) leaseState = lcd.state;
    const lcdProvider = lcd?.provider || provider;
    const job: GpuJob = {
      ...(byId || byDseq || {}),
      id: input.jobId,
      kind: "akash-lease",
      dseq: parsed.dseq,
      owner,
      provider_owner: lcdProvider || provider,
      provider_id: lcdProvider || provider,
      gseq: byId?.gseq ?? byDseq?.gseq ?? lcd?.gseq ?? 1,
      oseq: byId?.oseq ?? byDseq?.oseq ?? lcd?.oseq ?? 1,
      lease_state: leaseState,
      internal_status:
        leaseState === "active"
          ? byId?.internal_status || byDseq?.internal_status || "running"
          : "expired",
    };
    if (!lcdProvider && !provider) {
      return { job: null, dseq: parsed.dseq, provider: "", leaseState };
    }
    return {
      job,
      dseq: parsed.dseq,
      provider: lcdProvider || provider,
      leaseState,
    };
  }

  const job = byId || byDseq;
  if (!job) {
    return {
      job: provider
        ? {
            id: input.jobId,
            kind: "akash-lease",
            dseq: parsed.dseq,
            provider_owner: provider,
            provider_id: provider,
            owner,
            lease_state: leaseState,
          }
        : null,
      dseq: parsed.dseq,
      provider,
      leaseState,
    };
  }

  return {
    job: {
      ...job,
      id: input.jobId,
      provider_owner: provider || job.provider_owner,
      lease_state: leaseState || job.lease_state,
    },
    dseq: parsed.dseq,
    provider: provider || sanitizeAkashAddress(job.provider_owner || job.provider_id) || "",
    leaseState: leaseState || String(job.lease_state || ""),
  };
}

export function isAkashLeaseJobId(jobId: string): boolean {
  return parseAkashLeaseJobId(jobId) != null;
}

export function isAkashLeaseTerminalReady(job: GpuJob): boolean {
  const leaseState = String(job.lease_state || "").toLowerCase();
  if (leaseState === "active") return true;
  if (leaseState && leaseState !== "active") return false;

  const status = String(job.internal_status || "").toLowerCase();
  if (["expired", "closed", "failed", "awaiting_bid", "bid_timeout"].includes(status)) {
    return false;
  }
  if (
    String(job.provider_status || "").toLowerCase() === "manifest_failed" &&
    leaseState !== "active"
  ) {
    return false;
  }
  return ["running", "delivered", "completed", "lease_active", "deployment_active"].includes(
    status,
  );
}

/** Jobs that can open terminal — prefers on-chain active leases over stale local flags. */
export function listTerminalReadyJobs(jobs: GpuJob[]): GpuJob[] {
  const byDseq = new Map<number, GpuJob>();
  const extras: GpuJob[] = [];
  for (const job of jobs) {
    if (!isAkashLeaseTerminalReady(job)) continue;
    if (job.dseq != null && job.dseq > 0) {
      byDseq.set(job.dseq, job);
    } else if (job.id) {
      extras.push(job);
    }
  }
  return [...byDseq.values(), ...extras].sort(
    (a, b) => Number(b.dseq ?? 0) - Number(a.dseq ?? 0),
  );
}

export { buildAkashLeaseJobId };
