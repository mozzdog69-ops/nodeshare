import {
  formatProviderGpuModel,
  isGenericGpuLabel,
  type ProviderGpuModel,
} from "@/lib/akash/gpu-models";
import type { ProviderConsoleMeta } from "@/lib/akash/fetch-console-providers";
import { providerCapacityBadge } from "@/lib/akash/provider-gpu-capacity";
import { lookupReferenceUsdHourly } from "@/lib/akash/gpu-reference-pricing";
import type { OfferCard } from "@/lib/akash/summarize";
import { parseHourlyAkt, parseHourlyUsd, usdHourlyToAkt } from "@/lib/gpu/quote-utils";

export type ConsoleGpuOfferCard = {
  id: string;
  providerOwner: string;
  providerLabel: string;
  gpuModel: string;
  /** Provider registry slug — used for on-chain SDL (e.g. rtx3060, a100). */
  gpuModelSlug: string;
  vram?: string;
  gpuInterface?: string;
  isOnline: boolean;
  /** Host has at least one free GPU slot (Console stats). */
  hasGpuCapacity: boolean;
  capacityLabel: string | null;
  priceHourly: string | null;
  pricePerBlock: string | null;
  basePriceUsd: number | null;
  basePriceAkt: number | null;
  lcdOrderId?: string;
  lcdPriceAmount?: string;
  lcdPriceDenom?: string;
  /** Provider has open GPU orders on Akash LCD (faster bids). */
  marketActive?: boolean;
  /** Likely bid within ~1 min (LCD spot and/or active market maker). */
  fastRentEligible?: boolean;
};

type ConsoleProviderRow = {
  owner?: string;
  isOnline?: boolean;
  gpuModels?: ProviderGpuModel[];
};

function shorten(addr: string): string {
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 10)}…${addr.slice(-4)}`;
}

function formatReferencePriceHourly(usdPerHour: number): string {
  return `$${usdPerHour.toFixed(usdPerHour < 0.01 ? 4 : 2)}/hr (ref.)`;
}

/** Best LCD spot order per provider (named GPU or any order for pricing hint). */
export function indexLcdOrdersByProvider(
  lcdCards: OfferCard[],
): Map<string, OfferCard> {
  const map = new Map<string, OfferCard>();
  for (const card of lcdCards) {
    const owner = card.providerOwner?.trim().toLowerCase();
    if (!owner) continue;
    const existing = map.get(owner);
    if (!existing) {
      map.set(owner, card);
      continue;
    }
    const curNamed = card.gpuModel && !isGenericGpuLabel(card.gpuModel);
    const prevNamed = existing.gpuModel && !isGenericGpuLabel(existing.gpuModel);
    if (curNamed && !prevNamed) map.set(owner, card);
  }
  return map;
}

export function consoleProvidersToGpuCards(input: {
  providers: ConsoleProviderRow[];
  providerMetaByOwner?: Record<string, ProviderConsoleMeta>;
  lcdByProvider?: Map<string, OfferCard>;
  marketActiveProviders?: Set<string>;
  limit?: number;
}): ConsoleGpuOfferCard[] {
  const lcd = input.lcdByProvider ?? new Map();
  const cards: ConsoleGpuOfferCard[] = [];

  for (const p of input.providers) {
    const owner = String(p.owner || "").trim();
    if (!/^akash1[a-z0-9]{38}$/i.test(owner)) continue;
    const models = Array.isArray(p.gpuModels) ? p.gpuModels : [];
    if (models.length === 0) continue;

    const lcdOrder = lcd.get(owner.toLowerCase());
    const providerLabel = shorten(owner);
    const meta = input.providerMetaByOwner?.[owner.toLowerCase()];
    const gpuAvailable = meta?.gpuAvailable ?? -1;
    const hasGpuCapacity = gpuAvailable < 0 || gpuAvailable > 0;
    const capacityLabel =
      gpuAvailable >= 0
        ? providerCapacityBadge({
            available: gpuAvailable,
            total: meta?.gpuTotal ?? 0,
            active: Math.max(0, (meta?.gpuTotal ?? 0) - gpuAvailable),
          })
        : null;

    for (const m of models) {
      const gpuModel = formatProviderGpuModel(m);
      if (!gpuModel) continue;
      const refUsd = lcdOrder?.basePriceUsd ?? lookupReferenceUsdHourly(gpuModel);
      const refAkt = refUsd ? usdHourlyToAkt(refUsd) : null;

      cards.push({
        id: `${owner.toLowerCase()}-${m.model}`,
        providerOwner: owner,
        providerLabel,
        gpuModel,
        gpuModelSlug: String(m.model || "").trim().toLowerCase(),
        vram: m.ram,
        gpuInterface: m.interface,
        isOnline: p.isOnline !== false,
        hasGpuCapacity,
        capacityLabel,
        priceHourly: lcdOrder?.priceHourly ?? (refUsd ? formatReferencePriceHourly(refUsd) : null),
        pricePerBlock: lcdOrder?.price ?? null,
        basePriceUsd: lcdOrder?.basePriceUsd ?? refUsd ?? parseHourlyUsd(lcdOrder?.priceHourly ?? null),
        basePriceAkt: lcdOrder?.basePriceAkt ?? refAkt ?? parseHourlyAkt(lcdOrder?.priceHourly ?? null),
        lcdOrderId: lcdOrder?.id,
        lcdPriceAmount: lcdOrder?.priceAmount,
        lcdPriceDenom: lcdOrder?.priceDenom,
        marketActive: input.marketActiveProviders?.has(owner.toLowerCase()) ?? false,
        fastRentEligible: hasGpuCapacity && p.isOnline !== false,
      });
    }
  }

  cards.sort((a, b) => {
    const aRent = a.isOnline && a.hasGpuCapacity;
    const bRent = b.isOnline && b.hasGpuCapacity;
    if (aRent !== bRent) return aRent ? -1 : 1;
    if (a.fastRentEligible !== b.fastRentEligible) return a.fastRentEligible ? -1 : 1;
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return a.gpuModel.localeCompare(b.gpuModel);
  });

  const cap = input.limit ?? 48;
  return cards.slice(0, cap);
}
