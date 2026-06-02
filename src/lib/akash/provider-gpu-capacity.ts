/** Console API `stats.gpu` snapshot for a provider host. */
export type ProviderGpuStats = {
  available: number;
  total: number;
  active: number;
};

export function readProviderGpuStats(provider: {
  stats?: { gpu?: { available?: number; total?: number; active?: number } };
}): ProviderGpuStats | null {
  const g = provider.stats?.gpu;
  if (!g || typeof g.available !== "number") return null;
  return {
    available: Math.max(0, g.available),
    total: Math.max(0, g.total ?? 0),
    active: Math.max(0, g.active ?? 0),
  };
}

/** Unknown stats → do not block (registry may omit stats). */
export function providerHasFreeGpu(stats: ProviderGpuStats | null | undefined): boolean {
  if (!stats) return true;
  return stats.available > 0;
}

export function providerCapacityBadge(stats: ProviderGpuStats | null | undefined): string | null {
  if (!stats || stats.total <= 0) return null;
  if (stats.available <= 0) return "Fully booked";
  if (stats.available === 1) return "1 GPU free";
  return `${stats.available} GPUs free`;
}

export function providerCapacityBlockReason(input: {
  providerOwner: string;
  gpuModelSlug?: string;
  stats: ProviderGpuStats | null;
}): string {
  const who = `${input.providerOwner.slice(0, 12)}…`;
  const model = input.gpuModelSlug ? ` ${input.gpuModelSlug.toUpperCase()}` : " GPU";
  if (input.stats && input.stats.total > 0) {
    return `Host ${who} is online but has no free${model} capacity (${input.stats.active}/${input.stats.total} in use). Pick a card that shows capacity free, or try RTX 3090 / A100.`;
  }
  return `Host ${who} has no free${model} capacity right now. Pick another Online card on the marketplace.`;
}
