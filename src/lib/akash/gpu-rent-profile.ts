import {
  isPremiumGpuModelSlug,
  lookupReferenceUsdHourly,
  resolveAkashGpuModelSlug,
} from "@/lib/akash/gpu-reference-pricing";
import { AKASH_BLOCKS_PER_HOUR } from "@/lib/akash/pricing";
import { UACT_PER_ACT } from "@/lib/akash/chain-config";

/** Max time across all bid-wait phases (Akash docs: wait ~30s+ before querying; bids often 30–90s). */
export const RENT_BID_MAX_WAIT_MS = 180_000;

/** Brief pause after deploy before first bid poll (providers often bid in 15–45s). */
export const RENT_BID_INITIAL_DELAY_MS = 6_000;

/** Extra wait when a phase times out but bids may still be indexing. */
export const RENT_BID_GRACE_MS = 75_000;

/** Locked catalog host (jjozzietech etc.) — allow up to ~2.5 min on signedBy phase. */
export const RENT_LOCKED_CATALOG_WAIT_MS = 150_000;

/** Poll interval while waiting for bids (ms). */
export const RENT_BID_POLL_MS = 1_000;

/** Per-phase wait weights (must sum to ~1). */
export const RENT_PHASE_WAIT_WEIGHTS = [0.18, 0.32, 0.5] as const;

export type GpuResourceProfile = {
  cpuUnits: number;
  memoryGi: number;
  storageGi: number;
};

type GpuResourceTier = "datacenter" | "premium" | "mid" | "entry";

const DATACENTER_SLUGS = new Set(["a100", "h100", "h200", "b200", "b300"]);

const MID_SLUGS = new Set([
  "rtx3090",
  "rtx3090ti",
  "rtx6000",
  "rtxa6000",
  "rtx4070",
  "rtx4070s",
  "rtx4000ada",
  "rtx4000sada",
  "rtx5060ti",
  "rtx5070",
  "rtx5090",
  "pro6000se",
  "pro6000we",
  "rtxa2000",
]);

const ENTRY_SLUGS = new Set([
  "t4",
  "p4",
  "p40",
  "p2000",
  "m4000",
  "gtx1050",
  "gtx1050ti",
  "gtx1070ti",
  "rtx3060",
  "rtx3060m",
  "rtx3070",
]);

function parseVramGi(vram: string | null | undefined): number {
  const m = String(vram || "").match(/(\d+)\s*(Gi|GB)?/i);
  if (!m) return 0;
  return Math.max(0, parseInt(m[1], 10));
}

function resourceTierForSlug(slug: string): GpuResourceTier {
  if (!slug) return "mid";
  if (DATACENTER_SLUGS.has(slug)) return "datacenter";
  if (isPremiumGpuModelSlug(slug) || slug === "rtx4090") return "premium";
  if (MID_SLUGS.has(slug)) return "mid";
  if (ENTRY_SLUGS.has(slug)) return "entry";
  if (slug.startsWith("rtx") || slug.startsWith("pro6000")) return "mid";
  if (slug.startsWith("gtx")) return "entry";
  return "mid";
}

/** CPU/RAM/disk sized for real GPU hosts — applies to every catalog model slug. */
export function resolveGpuResourceProfile(input: {
  gpuModelSlug?: string | null;
  gpuLabel?: string | null;
  gpuVram?: string | null;
}): GpuResourceProfile {
  const slug = resolveAkashGpuModelSlug(input) ?? "";
  const vramGi = parseVramGi(input.gpuVram);
  const tier = resourceTierForSlug(slug);

  switch (tier) {
    case "datacenter":
      return {
        cpuUnits: 8,
        memoryGi: Math.max(64, vramGi > 0 ? vramGi * 2 : 64),
        storageGi: 128,
      };
    case "premium":
      return {
        cpuUnits: 8,
        memoryGi: Math.max(64, vramGi > 0 ? vramGi * 2 : 64),
        storageGi: 128,
      };
    case "mid":
      return {
        cpuUnits: 2,
        memoryGi: Math.max(16, vramGi > 0 ? Math.ceil(vramGi * 1.25) : 16),
        storageGi: 32,
      };
    case "entry":
      return { cpuUnits: 4, memoryGi: Math.max(16, vramGi || 16), storageGi: 32 };
    default:
      return { cpuUnits: 4, memoryGi: 16, storageGi: 40 };
  }
}

/** Floor uact/block — derived from reference $/hr and tier (all models). */
export function minimumUactPerBlockForModel(slug: string, openMarket: boolean): number {
  const tier = resourceTierForSlug(slug);
  const tierFloor =
    tier === "datacenter"
      ? openMarket
        ? 15_000
        : 22_000
      : tier === "premium"
        ? openMarket
          ? 15_000
          : 22_000
        : tier === "mid"
          ? openMarket
            ? 12_000
            : 18_000
          : openMarket
            ? 5_000
            : 8_000;

  const refUsd = lookupReferenceUsdHourly(slug) ?? lookupReferenceUsdHourly(slug.replace(/\d+$/, "")) ?? 0;
  if (refUsd > 0) {
    const mult = openMarket ? 2.0 : 2.75;
    const perBlock = Math.ceil(((refUsd * mult) / AKASH_BLOCKS_PER_HOUR) * UACT_PER_ACT);
    return Math.max(perBlock, tierFloor);
  }
  return tierFloor;
}

/** Parse LCD / API price amount string → uact per block when denom is uact. */
export function parseUactPerBlockFromPrice(
  amount: string | null | undefined,
  denom?: string | null,
): string | null {
  const d = String(denom || "uact").toLowerCase();
  if (d !== "uact" && !d.endsWith("uact")) return null;
  const n = Number(String(amount || "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  const uact = n >= 1 ? Math.ceil(n) : Math.ceil(n * UACT_PER_ACT);
  return String(Math.max(1, uact));
}
