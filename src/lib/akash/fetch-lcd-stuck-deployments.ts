import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { UACT_PER_ACT } from "@/lib/akash/chain-config";

export type StuckAkashDeployment = {
  dseq: number;
  escrowUact: number;
  escrowAct: number;
  gpuLabel: string;
  /** @deprecated Always empty — use legacyMisusedSignedBy for old deploys. */
  preferredProviders: string[];
  /** Old NodeShare SDL used provider addresses in signedBy (invalid per Akash docs). */
  legacyMisusedSignedBy?: string[];
  createdAt?: string;
};

/** LCD deployment row (snake_case JSON from REST). */
type DeploymentQueryRow = {
  deployment?: { id?: { dseq?: string }; created_at?: string };
  groups?: {
    group_spec?: {
      resources?: {
        resource?: {
          gpu?: { attributes?: { key?: string; value?: string }[] };
        };
      }[];
      requirements?: { signed_by?: { any_of?: string[] } };
    };
  }[];
  escrow_account?: {
    state?: { funds?: { denom?: string; amount?: string }[] };
  };
};

function lcdBases(): string[] {
  const env = process.env.AKASH_LCD_URL?.trim();
  const list = env ? [env] : [...DEFAULT_AKASH_LCD_BASES];
  return list.map((b) => b.replace(/\/$/, ""));
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: AKASH_FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function parseEscrowUact(row: DeploymentQueryRow): number {
  const funds = row.escrow_account?.state?.funds ?? [];
  const uact = funds.find((f) => f.denom === "uact");
  const raw = Number(uact?.amount ?? 0);
  return Number.isFinite(raw) ? Math.floor(raw) : 0;
}

function parseGpuLabel(row: DeploymentQueryRow): string {
  const attrs =
    row.groups?.[0]?.group_spec?.resources?.[0]?.resource?.gpu?.attributes ?? [];
  const model = attrs.find((a) => a.key?.includes("/model/") && a.value === "true");
  if (model?.key) {
    const slug = model.key.split("/model/")[1]?.split("/")[0];
    if (slug) return slug;
  }
  return "GPU";
}

function parseLegacyMisusedSignedBy(row: DeploymentQueryRow): string[] {
  const any = row.groups?.[0]?.group_spec?.requirements?.signed_by?.any_of ?? [];
  return any.filter((a) => typeof a === "string" && /^akash1[a-z0-9]{38}$/.test(a));
}

function tryDeployments(json: unknown): DeploymentQueryRow[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const rows = o.deployments ?? o.deployment;
  return Array.isArray(rows) ? (rows as DeploymentQueryRow[]) : [];
}

function leasedDseqs(json: unknown): Set<number> {
  const out = new Set<number>();
  if (!json || typeof json !== "object") return out;
  const o = json as Record<string, unknown>;
  const leases = o.leases ?? o.lease;
  if (!Array.isArray(leases)) return out;
  for (const row of leases) {
    const lease = (row as { lease?: { id?: { dseq?: string } } }).lease ?? row;
    const dseq = Number((lease as { id?: { dseq?: string } }).id?.dseq ?? 0);
    if (dseq) out.add(dseq);
  }
  return out;
}

const DEPLOY_API_VERSIONS = ["v1beta4", "v1beta3"] as const;
const LEASE_API_VERSIONS = ["v1beta5", "v1beta4"] as const;

/** List active deployments with no lease via Akash LCD (no chain SDK / no atob). */
export async function listStuckAkashDeploymentsByAddress(
  owner: string,
): Promise<StuckAkashDeployment[]> {
  const address = owner.trim();
  if (!/^akash1[a-z0-9]{38}$/.test(address)) {
    throw new Error("Invalid Akash address.");
  }

  let deployments: DeploymentQueryRow[] = [];
  let leased = new Set<number>();

  for (const base of lcdBases()) {
    for (const ver of DEPLOY_API_VERSIONS) {
      const qs = new URLSearchParams({
        "filters.owner": address,
        "filters.state": "active",
        "pagination.limit": "50",
      });
      const json = await fetchJson(`${base}/akash/deployment/${ver}/deployments/list?${qs}`);
      const rows = tryDeployments(json);
      if (rows.length > 0) {
        deployments = rows;
        break;
      }
    }
    if (deployments.length > 0) break;
  }

  for (const base of lcdBases()) {
    for (const ver of LEASE_API_VERSIONS) {
      const qs = new URLSearchParams({
        "filters.owner": address,
        "pagination.limit": "100",
      });
      const json = await fetchJson(`${base}/akash/market/${ver}/leases/list?${qs}`);
      leased = leasedDseqs(json);
      if (leased.size > 0 || json != null) break;
    }
    if (leased.size > 0) break;
  }

  const stuck: StuckAkashDeployment[] = [];

  for (const row of deployments) {
    const dseq = Number(row.deployment?.id?.dseq ?? 0);
    if (!dseq || leased.has(dseq)) continue;

    const escrowUact = parseEscrowUact(row);
    const legacyMisusedSignedBy = parseLegacyMisusedSignedBy(row);
    stuck.push({
      dseq,
      escrowUact,
      escrowAct: escrowUact / UACT_PER_ACT,
      gpuLabel: parseGpuLabel(row),
      preferredProviders: [],
      legacyMisusedSignedBy:
        legacyMisusedSignedBy.length > 0 ? legacyMisusedSignedBy : undefined,
      createdAt: row.deployment?.created_at,
    });
  }

  return stuck.sort((a, b) => b.dseq - a.dseq);
}

export type LeasedAkashDeployment = StuckAkashDeployment & {
  provider: string;
  kind: "leased";
};

/** Active deployments that already have a lease — close on GPU Jobs / here to recover escrow. */
export async function listLeasedAkashDeploymentsByAddress(
  owner: string,
): Promise<LeasedAkashDeployment[]> {
  const address = owner.trim();
  if (!/^akash1[a-z0-9]{38}$/.test(address)) {
    throw new Error("Invalid Akash address.");
  }

  let deployments: DeploymentQueryRow[] = [];
  let leased = new Map<number, string>();

  for (const base of lcdBases()) {
    for (const ver of DEPLOY_API_VERSIONS) {
      const qs = new URLSearchParams({
        "filters.owner": address,
        "filters.state": "active",
        "pagination.limit": "50",
      });
      const json = await fetchJson(`${base}/akash/deployment/${ver}/deployments/list?${qs}`);
      const rows = tryDeployments(json);
      if (rows.length > 0) {
        deployments = rows;
        break;
      }
    }
    if (deployments.length > 0) break;
  }

  for (const base of lcdBases()) {
    for (const ver of LEASE_API_VERSIONS) {
      const qs = new URLSearchParams({
        "filters.owner": address,
        "pagination.limit": "100",
      });
      const json = await fetchJson(`${base}/akash/market/${ver}/leases/list?${qs}`);
      if (!json || typeof json !== "object") continue;
      const o = json as Record<string, unknown>;
      const leases = o.leases ?? o.lease;
      if (!Array.isArray(leases)) continue;
      for (const row of leases) {
        const lease =
          (row as { lease?: { id?: { dseq?: string; provider?: string }; state?: string } }).lease ??
          row;
        const state = String((lease as { state?: string }).state ?? "").toLowerCase();
        if (state !== "active") continue;
        const id = (lease as { id?: { dseq?: string; provider?: string } }).id ?? lease;
        const dseq = Number((id as { dseq?: string }).dseq ?? 0);
        const provider = String((id as { provider?: string }).provider ?? "").trim();
        if (dseq && provider) leased.set(dseq, provider);
      }
      if (leased.size > 0) break;
    }
    if (leased.size > 0) break;
  }

  const out: LeasedAkashDeployment[] = [];
  for (const row of deployments) {
    const dseq = Number(row.deployment?.id?.dseq ?? 0);
    const provider = leased.get(dseq);
    if (!dseq || !provider) continue;
    const escrowUact = parseEscrowUact(row);
    const legacyMisusedSignedBy = parseLegacyMisusedSignedBy(row);
    out.push({
      dseq,
      escrowUact,
      escrowAct: escrowUact / UACT_PER_ACT,
      gpuLabel: parseGpuLabel(row),
      preferredProviders: [],
      legacyMisusedSignedBy:
        legacyMisusedSignedBy.length > 0 ? legacyMisusedSignedBy : undefined,
      createdAt: row.deployment?.created_at,
      provider,
      kind: "leased",
    });
  }
  return out.sort((a, b) => b.dseq - a.dseq);
}
