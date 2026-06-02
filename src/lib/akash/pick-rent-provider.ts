import { fetchConsoleProvidersByOwner, type ProviderConsoleMeta } from "@/lib/akash/fetch-console-providers";
import { resolveAkashGpuModelSlug } from "@/lib/akash/gpu-reference-pricing";
import type { ProviderGpuModel } from "@/lib/akash/gpu-models";
import { providerCapacityBlockReason } from "@/lib/akash/provider-gpu-capacity";
import { marketActiveProvidersFromOrders } from "@/lib/akash/rent-wait-estimate";
import { LOW_BID_RELIABILITY_PROVIDERS } from "@/lib/akash/rent-wait-estimate";

export type RentProviderTarget = {
  providerOwners: string[];
  openToAnyProvider: boolean;
  summary: string;
  warn?: string;
  rentBlocked?: boolean;
  blockReason?: string;
};

export type CatalogGpuPick = {
  providerOwner: string;
  gpuModelSlug: string;
};

function apiBase(): string {
  if (typeof window !== "undefined") return "";
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "").replace(/\/$/, "");
}

function isAkashOwner(a: string) {
  return /^akash1[a-z0-9]{38}$/.test(a.trim());
}

function modelMatches(models: ProviderGpuModel[], slug: string): boolean {
  const want = slug.toLowerCase();
  return models.some((m) => String(m.model || "").trim().toLowerCase() === want);
}

function hostHasGpuCapacity(meta: ProviderConsoleMeta | undefined): boolean {
  if (!meta) return true;
  if (meta.gpuAvailable < 0) return true;
  return meta.gpuAvailable > 0;
}

async function fetchConsoleRegistry(): Promise<{
  providersByOwner: Record<string, ProviderGpuModel[]>;
  providerMetaByOwner: Record<string, ProviderConsoleMeta>;
  providerCount: number;
  error?: string;
}> {
  try {
    const res = await fetch(`${apiBase()}/api/akash/providers`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return { providersByOwner: {}, providerMetaByOwner: {}, providerCount: 0, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      data?: {
        providersByOwner?: Record<string, ProviderGpuModel[]>;
        providerMetaByOwner?: Record<string, ProviderConsoleMeta>;
        providerCount?: number;
      };
    };
    if (!json.ok) {
      return {
        providersByOwner: {},
        providerMetaByOwner: {},
        providerCount: 0,
        error: json.error ?? "Console registry unavailable",
      };
    }
    return {
      providersByOwner: json.data?.providersByOwner ?? {},
      providerMetaByOwner: json.data?.providerMetaByOwner ?? {},
      providerCount: json.data?.providerCount ?? Object.keys(json.data?.providersByOwner ?? {}).length,
    };
  } catch (e) {
    return {
      providersByOwner: {},
      providerMetaByOwner: {},
      providerCount: 0,
      error: e instanceof Error ? e.message : "Console registry fetch failed",
    };
  }
}

/** Server-side fallback when API route is not used. */
async function fetchConsoleRegistryDirect() {
  const { providersByOwner, providerMetaByOwner, error } = await fetchConsoleProvidersByOwner();
  return {
    providersByOwner,
    providerMetaByOwner,
    providerCount: Object.keys(providersByOwner).length,
    error,
  };
}

async function loadConsoleRegistry() {
  const viaApi = await fetchConsoleRegistry();
  if (viaApi.providerCount > 0) return viaApi;
  if (viaApi.error) {
    const direct = await fetchConsoleRegistryDirect();
    if (direct.providerCount > 0) return { ...direct, error: undefined };
    return viaApi;
  }
  return viaApi;
}

export async function fetchMarketActiveGpuProviders(): Promise<Set<string>> {
  try {
    const res = await fetch(`${apiBase()}/api/akash/market?limit=50`, {
      cache: "no-store",
      signal: AbortSignal.timeout(22_000),
    });
    if (!res.ok) return new Set();
    const json = (await res.json()) as {
      ok?: boolean;
      data?: {
        orders?: unknown[];
        providersByOwner?: Record<string, ProviderGpuModel[]>;
      };
    };
    if (!json.ok || !json.data?.orders) return new Set();
    return marketActiveProvidersFromOrders(
      json.data.orders,
      json.data.providersByOwner ?? {},
    );
  } catch {
    return new Set();
  }
}

async function providerHasHostUri(owner: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${apiBase()}/api/akash/provider?owner=${encodeURIComponent(owner)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return true;
    const json = (await res.json()) as { ok?: boolean; data?: { hasHostUri?: boolean } };
    return json.ok ? json.data?.hasHostUri !== false : true;
  } catch {
    return true;
  }
}

function pickHosts(
  ranked: { owner: string }[],
  max: number,
  marketActive: Set<string>,
): string[] {
  const sorted = [...ranked].sort((a, b) => {
    const aM = marketActive.has(a.owner) ? 0 : 1;
    const bM = marketActive.has(b.owner) ? 0 : 1;
    if (aM !== bM) return aM - bM;
    const aBad = LOW_BID_RELIABILITY_PROVIDERS.has(a.owner) ? 1 : 0;
    const bBad = LOW_BID_RELIABILITY_PROVIDERS.has(b.owner) ? 1 : 0;
    if (aBad !== bBad) return aBad - bBad;
    return a.owner.localeCompare(b.owner);
  });
  return sorted.slice(0, max).map((c) => c.owner);
}

function listOnlineProvidersForSlug(input: {
  providersByOwner: Record<string, ProviderGpuModel[]>;
  providerMetaByOwner: Record<string, ProviderConsoleMeta>;
  slug: string;
  exclude?: string;
}): { owner: string }[] {
  const out: { owner: string }[] = [];
  for (const [ownerKey, models] of Object.entries(input.providersByOwner)) {
    const owner = ownerKey.toLowerCase();
    if (input.exclude && owner === input.exclude) continue;
    if (!isAkashOwner(owner)) continue;
    if (input.providerMetaByOwner[ownerKey]?.isOnline === false) continue;
    if (!hostHasGpuCapacity(input.providerMetaByOwner[ownerKey])) continue;
    if (input.slug && !modelMatches(models, input.slug)) continue;
    if (LOW_BID_RELIABILITY_PROVIDERS.has(owner)) continue;
    out.push({ owner });
  }
  return out;
}

async function lockToProviders(input: {
  owners: string[];
  slug: string;
  marketActive: Set<string>;
}): Promise<RentProviderTarget> {
  const owners = [...new Set(input.owners.map((o) => o.toLowerCase()))].filter(isAkashOwner);
  if (owners.length === 0) {
    return {
      providerOwners: [],
      openToAnyProvider: true,
      summary: "Open market — any matching GPU host may bid.",
    };
  }
  const verified: string[] = [];
  for (const owner of owners) {
    if (await providerHasHostUri(owner)) verified.push(owner);
  }
  const picked = verified.length > 0 ? verified : owners;
  const label = picked.map((o) => o.slice(0, 10)).join(", ");
  const anyMarket = picked.some((o) => input.marketActive.has(o));
  return {
    providerOwners: picked,
    openToAnyProvider: true,
    summary:
      picked.length > 1
        ? `Preferring ${label}… (${input.slug}) — open deployment, first matching bid wins.`
        : anyMarket
          ? `Preferring ${picked[0].slice(0, 12)}… — active GPU host for ${input.slug}.`
          : `Preferring ${picked[0].slice(0, 12)}… (${input.slug}).`,
    warn:
      picked.length > 1 && !input.marketActive.has(picked[0])
        ? "Including backup hosts — your card provider may bid slowly."
        : undefined,
  };
}

async function lockToProvider(input: {
  owner: string;
  slug: string;
  marketActive: Set<string>;
}): Promise<RentProviderTarget> {
  return lockToProviders({
    owners: [input.owner],
    slug: input.slug,
    marketActive: input.marketActive,
  });
}

/**
 * Pick provider(s) to lock the deployment before create.
 */
export async function resolveRentProviderTarget(input: {
  gpuModelSlug?: string | null;
  gpuLabel?: string | null;
  preferredOwner?: string | null;
  maxProviders?: number;
  /** User chose an Online card on the marketplace — trust provider + slug. */
  catalogPick?: CatalogGpuPick | null;
}): Promise<RentProviderTarget> {
  const slug =
    resolveAkashGpuModelSlug({
      gpuModelSlug: input.gpuModelSlug,
      gpuLabel: input.gpuLabel,
    }) ?? "";
  const preferred = String(input.preferredOwner || input.catalogPick?.providerOwner || "")
    .trim()
    .toLowerCase();
  const max = Math.min(3, Math.max(1, input.maxProviders ?? 3));

  const [registry, marketActive] = await Promise.all([
    loadConsoleRegistry(),
    fetchMarketActiveGpuProviders(),
  ]);

  const { providersByOwner, providerMetaByOwner, providerCount, error: registryError } =
    registry;

  // Marketplace Online card — prefer that host (open SDL; filter bids in-app)
  if (input.catalogPick && isAkashOwner(input.catalogPick.providerOwner)) {
    const catalogOwner = input.catalogPick.providerOwner.toLowerCase();
    const catalogSlug =
      resolveAkashGpuModelSlug({
        gpuModelSlug: input.catalogPick.gpuModelSlug,
        gpuLabel: input.gpuLabel,
      }) ?? slug;
    const useSlug = catalogSlug || slug || "gpu";

    if (providerCount === 0 || registryError) {
      return {
        ...(await lockToProvider({ owner: catalogOwner, slug: useSlug, marketActive })),
        warn: "Using your marketplace pick — provider registry was slow to refresh.",
      };
    }

    const models = providersByOwner[catalogOwner] ?? [];
    const catalogMeta = providerMetaByOwner[catalogOwner];
    if (catalogMeta && !hostHasGpuCapacity(catalogMeta)) {
      const stats =
        catalogMeta.gpuTotal > 0
          ? {
              available: catalogMeta.gpuAvailable,
              total: catalogMeta.gpuTotal,
              active: Math.max(0, catalogMeta.gpuTotal - catalogMeta.gpuAvailable),
            }
          : null;
      const reason = providerCapacityBlockReason({
        providerOwner: catalogOwner,
        gpuModelSlug: useSlug,
        stats,
      });
      return {
        providerOwners: [],
        openToAnyProvider: true,
        rentBlocked: true,
        blockReason: reason,
        summary: reason,
      };
    }
    if (models.length === 0 || !useSlug || modelMatches(models, useSlug)) {
      const backups = pickHosts(
        listOnlineProvidersForSlug({
          providersByOwner,
          providerMetaByOwner,
          slug: useSlug,
          exclude: catalogOwner,
        }),
        2,
        marketActive,
      );
      return lockToProviders({
        owners: [catalogOwner, ...backups],
        slug: useSlug,
        marketActive,
      });
    }

    return {
      providerOwners: [],
      openToAnyProvider: true,
      rentBlocked: true,
      blockReason: `Provider ${catalogOwner.slice(0, 12)}… does not list ${useSlug} in the Console registry. Pick the matching GPU card on the marketplace.`,
      summary: `This host does not offer ${useSlug} — choose another GPU card.`,
      warn: undefined,
    };
  }

  if (registryError || providerCount === 0) {
    if (preferred && isAkashOwner(preferred) && slug) {
      return {
        ...(await lockToProvider({ owner: preferred, slug, marketActive })),
        warn: "Provider registry unavailable — using your selected marketplace host.",
      };
    }
    return {
      providerOwners: [],
      openToAnyProvider: true,
      summary: "Open market — provider catalog could not be loaded; try again in a moment.",
      warn: registryError,
    };
  }

  const onlineWithModel: { owner: string }[] = [];
  const onlineWithModelNoCapacity: { owner: string }[] = [];

  for (const [ownerKey, models] of Object.entries(providersByOwner)) {
    const owner = ownerKey.toLowerCase();
    if (!isAkashOwner(owner)) continue;
    if (providerMetaByOwner[ownerKey]?.isOnline === false) continue;
    if (slug && !modelMatches(models, slug)) continue;
    if (!hostHasGpuCapacity(providerMetaByOwner[ownerKey])) {
      onlineWithModelNoCapacity.push({ owner });
      continue;
    }
    onlineWithModel.push({ owner });
  }

  if (slug && onlineWithModel.length === 0) {
    const totalWithModel = Object.entries(providersByOwner).filter(([, models]) =>
      modelMatches(models, slug),
    ).length;
    const reason =
      onlineWithModelNoCapacity.length > 0 && totalWithModel > 0
        ? `All ${slug} hosts are fully booked on Akash (${onlineWithModelNoCapacity.length} online, 0 free GPUs). Try RTX 3090 or A100, or refresh later.`
        : totalWithModel > 0
          ? `All ${slug} hosts are offline on Akash right now (${totalWithModel} in catalog). Pick another GPU that shows Online on the marketplace.`
          : `No Akash provider lists ${slug} in the Console registry. Try RTX 3090 or A100.`;
    return {
      providerOwners: [],
      openToAnyProvider: true,
      rentBlocked: true,
      blockReason: reason,
      summary: reason,
    };
  }

  const preferredOk =
    preferred &&
    isAkashOwner(preferred) &&
    onlineWithModel.some((c) => c.owner === preferred) &&
    !LOW_BID_RELIABILITY_PROVIDERS.has(preferred);

  if (preferredOk) {
    return lockToProvider({ owner: preferred, slug: slug || "gpu", marketActive });
  }

  const preferredWeak =
    preferred &&
    isAkashOwner(preferred) &&
    (LOW_BID_RELIABILITY_PROVIDERS.has(preferred) ||
      (slug && !marketActive.has(preferred) && onlineWithModel.some((c) => c.owner === preferred)));

  const ranked = [...onlineWithModel].sort((a, b) => {
    if (a.owner === preferred) return -1;
    if (b.owner === preferred) return 1;
    return 0;
  });

  const pickedRaw = pickHosts(ranked, max, marketActive);
  const picked: string[] = [];
  for (const owner of pickedRaw) {
    if (await providerHasHostUri(owner)) picked.push(owner);
  }
  if (picked.length === 0 && ranked.length > 0) {
    picked.push(...ranked.slice(0, max).map((c) => c.owner));
  }

  if (picked.length > 0) {
    const target = await lockToProviders({ owners: picked, slug: slug || "gpu", marketActive });
    if (preferredWeak) {
      return {
        ...target,
        warn: `Provider ${preferred.slice(0, 12)}… often bids slowly — using faster hosts when possible.`,
      };
    }
    return target;
  }

  return {
    providerOwners: [],
    openToAnyProvider: true,
    summary: slug
      ? `Open market for ${slug} — no verified online host passed checks.`
      : "Open market — pick a GPU from the marketplace catalog.",
    warn: "Try another Online GPU card on the marketplace.",
  };
}

export async function fetchLcdActiveProvidersForSlug(slug: string): Promise<Set<string>> {
  const market = await fetchMarketActiveGpuProviders();
  if (!slug) return market;
  const { providersByOwner } = await loadConsoleRegistry();
  const out = new Set<string>();
  for (const owner of market) {
    const models = providersByOwner[owner] ?? [];
    if (modelMatches(models, slug)) out.add(owner);
  }
  return out;
}
