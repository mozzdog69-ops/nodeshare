import { buildAkashLeaseJobId } from "@/lib/akash/akash-lease-job-id";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { fetchDeploymentRowLcd } from "@/lib/akash/recover-manifest-json";
import type { GpuJob } from "@/lib/gpu/types";

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

function gpuLabelFromDeploymentRow(
  row: Awaited<ReturnType<typeof fetchDeploymentRowLcd>>,
): string {
  const attrs =
    row?.groups?.[0]?.group_spec?.resources?.[0]?.resource?.gpu?.attributes ?? [];
  const model = attrs.find((a) => a.key?.includes("/model/") && a.value === "true");
  if (model?.key?.includes("/model/*")) return "Any NVIDIA GPU";
  if (model?.key) {
    const slug = model.key.split("/model/")[1]?.split("/")[0];
    if (slug && slug !== "*") return `NVIDIA ${slug}`;
  }
  return "Akash GPU";
}

type LeaseRow = {
  lease?: {
    id?: { dseq?: string; gseq?: number; oseq?: number; provider?: string };
    state?: string;
    created_at?: string;
  };
};

function parseLeaseRows(json: unknown): LeaseRow[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const leases = o.leases ?? o.lease;
  return Array.isArray(leases) ? (leases as LeaseRow[]) : [];
}

/** Build GPU job rows from on-chain active leases (same on any browser/device). */
export async function fetchAkashRentalJobsFromLcd(owner: string): Promise<GpuJob[]> {
  const address = sanitizeAkashAddress(owner);
  if (!address) return [];

  const qs = new URLSearchParams({
    "filters.owner": address,
    "pagination.limit": "50",
  });

  let leaseRows: LeaseRow[] = [];
  for (const base of lcdBases()) {
    for (const ver of ["v1beta5", "v1beta4"] as const) {
      const url = `${base}/akash/market/${ver}/leases/list?${qs}`;
      try {
        const res = await fetch(url, {
          headers: AKASH_FETCH_HEADERS,
          cache: "no-store",
          signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) continue;
        const json = await res.json();
        leaseRows = parseLeaseRows(json);
        if (leaseRows.length) break;
      } catch {
        /* next */
      }
    }
    if (leaseRows.length) break;
  }

  const jobs: GpuJob[] = [];
  const seenDseq = new Set<number>();

  for (const row of leaseRows) {
    const lease = row.lease ?? row;
    const id = (lease as { id?: { dseq?: string; gseq?: number; oseq?: number; provider?: string } }).id;
    const dseq = Math.floor(Number(id?.dseq ?? 0));
    if (!dseq || seenDseq.has(dseq)) continue;
    const state = String((lease as { state?: string }).state ?? "").toLowerCase() || "active";
    const provider = sanitizeAkashAddress(id?.provider);
    if (!provider) continue;
    seenDseq.add(dseq);

    const gseq = Number(id?.gseq ?? 1);
    const oseq = Number(id?.oseq ?? 1);
    const depRow = await fetchDeploymentRowLcd(address, dseq);
    const gpuLabel = gpuLabelFromDeploymentRow(depRow);
    const createdAt =
      String((lease as { created_at?: string }).created_at ?? "").trim() ||
      new Date().toISOString();
    const active = state === "active";

    jobs.push({
      id: buildAkashLeaseJobId(dseq, provider),
      kind: "akash-lease",
      lease_state: state,
      internal_status: active ? "lease_active" : "expired",
      provider_status: active ? "lease_active" : state || "closed",
      created_at: createdAt,
      title: `${gpuLabel} · dseq ${dseq}${active ? "" : " (ended)"}`,
      provider_id: provider,
      provider_owner: provider,
      owner: address,
      dseq,
      gseq,
      oseq,
      gpu_model: gpuLabel,
      rent_sdl: {
        hours: 1,
        hourlyAkt: 0.5,
        gpuLabel,
        anyNvidiaGpu: gpuLabel.toLowerCase().includes("any nvidia"),
        openToAnyProvider: true,
      },
    });
  }

  return jobs.sort((a, b) => Number(b.dseq ?? 0) - Number(a.dseq ?? 0));
}

export function mergeChainJobsWithLocal(chainJobs: GpuJob[], localJobs: GpuJob[]): GpuJob[] {
  const byDseq = new Map<number, GpuJob>();
  for (const job of chainJobs) {
    if (job.dseq != null) byDseq.set(job.dseq, job);
  }
  for (const local of localJobs) {
    if (local.dseq == null) continue;
    const chain = byDseq.get(local.dseq);
    const manifestFailed =
      String(local.provider_status || "").toLowerCase() === "manifest_failed" ||
      /manifest upload|manifest version validation|hash mismatch/i.test(
        String(local.error_message || ""),
      );
    if (chain) {
      const chainActive = String(chain.lease_state || "").toLowerCase() === "active";
      const rentSdlMerge = local.rent_sdl?.manifestJson
        ? {
            rent_sdl: {
              ...chain.rent_sdl,
              ...local.rent_sdl,
              manifestJson: local.rent_sdl.manifestJson,
            },
          }
        : local.rent_sdl
          ? { rent_sdl: { ...chain.rent_sdl, ...local.rent_sdl } }
          : {};

      if (chainActive) {
        const localRunning = ["running", "delivered", "completed"].includes(
          String(local.internal_status || "").toLowerCase(),
        );
        byDseq.set(local.dseq, {
          ...chain,
          ...rentSdlMerge,
          lease_state: "active",
          internal_status: localRunning ? local.internal_status! : "running",
          provider_status: "lease_active",
          title: local.title || chain.title,
          deployment_tx_hash: local.deployment_tx_hash ?? chain.deployment_tx_hash,
          lease_tx_hash: local.lease_tx_hash ?? chain.lease_tx_hash,
          deposit_akt: local.deposit_akt ?? chain.deposit_akt,
          error_message: undefined,
        });
      } else if (manifestFailed) {
        byDseq.set(local.dseq, {
          ...chain,
          ...rentSdlMerge,
          internal_status: "lease_active",
          provider_status: "manifest_failed",
          error_message: local.error_message,
        });
      } else {
        byDseq.set(local.dseq, {
          ...chain,
          ...rentSdlMerge,
          internal_status: local.internal_status || chain.internal_status,
          provider_status: local.provider_status || chain.provider_status,
          lease_state: chain.lease_state ?? local.lease_state,
          error_message: local.error_message,
          deployment_tx_hash: local.deployment_tx_hash ?? chain.deployment_tx_hash,
          lease_tx_hash: local.lease_tx_hash ?? chain.lease_tx_hash,
          deposit_akt: local.deposit_akt ?? chain.deposit_akt,
        });
      }
    } else {
      byDseq.set(local.dseq, local);
    }
  }
  const extras = localJobs.filter((j) => j.dseq == null || !byDseq.has(j.dseq));
  return [...Array.from(byDseq.values()), ...extras].sort(
    (a, b) =>
      new Date(String(b.created_at || 0)).getTime() - new Date(String(a.created_at || 0)).getTime(),
  );
}
