/**
 * Akash Console “starting at” USD/hr reference rates (marketplace floor, not a specific bid).
 * Used when a provider has no open LCD order for that GPU.
 */
const USD_HOURLY_BY_MODEL: Record<string, number> = {
  b300: 6.0,
  b200: 5.0,
  h200: 2.65,
  pro6000se: 1.88,
  pro6000we: 1.52,
  h100: 2.51,
  a100: 1.22,
  rtx5090: 0.56,
  rtx4090: 0.31,
  rtx3090ti: 0.29,
  rtx3090: 0.12,
  rtx6000: 0.17,
  rtxa6000: 0.17,
  p40: 0.08,
  rtx4070: 0.09,
  rtx5060ti: 0.23,
  rtx5070: 0.1,
  gtx1070ti: 0.11,
  m4000: 0.05,
  p2000: 0.63,
  p4: 0.06,
  rtx3060: 0.05,
  rtx3060m: 0.05,
  rtx3070: 0.02,
  rtx4000ada: 0.16,
  rtx4000sada: 0.64,
  rtx4070s: 0.53,
  rtxa2000: 0.64,
  t4: 0.11,
  gtx1050: 0.06,
  gtx1050ti: 0.06,
};

/** Normalize catalog label → model slug, e.g. "NVIDIA RTX 3090 · 24Gi" → rtx3090 */
export function gpuLabelToModelSlug(gpuLabel: string): string {
  const raw = gpuLabel.trim().toLowerCase();
  const withoutVram = raw.replace(/\s*·\s*\d+\s*gi\s*$/i, "").trim();
  const tokens = withoutVram.replace(/^nvidia\s+|^amd\s+/i, "").replace(/\s+/g, "");
  if (!tokens) return "";

  if (tokens.startsWith("pro6000")) {
    if (tokens.includes("se")) return "pro6000se";
    if (tokens.includes("we")) return "pro6000we";
    return "pro6000we";
  }
  if (tokens.startsWith("rtx") || tokens.startsWith("gtx")) return tokens;
  if (/^a100|^h100|^h200|^b200|^b300|^p40|^p4|^p2000|^m4000|^t4$/i.test(tokens)) {
    return tokens.replace(/\s+/g, "");
  }
  return tokens;
}

/** Akash provider-configs model slug: lowercase alphanumeric (e.g. rtx3060, a100). */
export const AKASH_GPU_MODEL_SLUG_RE = /^[a-z][a-z0-9]*$/;

export function isValidAkashGpuModelSlug(slug: string): boolean {
  return AKASH_GPU_MODEL_SLUG_RE.test(slug.trim().toLowerCase());
}

/** Canonical SDL model slug from provider API slug or display label. */
export function resolveAkashGpuModelSlug(input: {
  gpuModelSlug?: string | null;
  gpuLabel?: string | null;
}): string | null {
  const direct = String(input.gpuModelSlug || "").trim().toLowerCase();
  if (direct && isValidAkashGpuModelSlug(direct)) return direct;
  const fromLabel = gpuLabelToModelSlug(input.gpuLabel || "");
  if (fromLabel && isValidAkashGpuModelSlug(fromLabel)) return fromLabel;
  return null;
}

/** High-demand GPUs — need higher on-chain bid rates for provider automation. */
export const PREMIUM_GPU_MODEL_SLUGS = new Set([
  "rtx5090",
  "rtx4090",
  "h100",
  "h200",
  "b200",
  "b300",
  "a100",
]);

export function isPremiumGpuModelSlug(slug: string | null | undefined): boolean {
  const s = String(slug || "").trim().toLowerCase();
  return Boolean(s && PREMIUM_GPU_MODEL_SLUGS.has(s));
}

export function lookupReferenceUsdHourly(gpuLabel: string): number | null {
  const slug = gpuLabelToModelSlug(gpuLabel);
  if (!slug) return null;
  if (USD_HOURLY_BY_MODEL[slug] != null) return USD_HOURLY_BY_MODEL[slug];

  // fuzzy: rtx3090m → rtx3090
  for (const [key, usd] of Object.entries(USD_HOURLY_BY_MODEL)) {
    if (slug.startsWith(key) || key.startsWith(slug)) return usd;
  }
  return null;
}

export function formatReferenceHourlyUsd(usd: number): string {
  if (usd < 0.01) return `~$${usd.toFixed(4)}/hr (ref.)`;
  if (usd < 1) return `~$${usd.toFixed(2)}/hr (ref.)`;
  return `~$${usd.toFixed(2)}/hr (ref.)`;
}
