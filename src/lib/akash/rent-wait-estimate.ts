import type { ProviderGpuModel } from "@/lib/akash/gpu-models";
import { ordersToOfferCards } from "@/lib/akash/summarize";

/** Hosts that often take 2–3+ min before first bid (still may bid). */
export const LOW_BID_RELIABILITY_PROVIDERS = new Set<string>([]);

export type RentWaitTone = "fast" | "moderate" | "slow" | "offline";

export type RentWaitEstimate = {
  /** Short label for marketplace cards, e.g. "Usually ~1 min" */
  badge: string;
  /** Provider bid step, e.g. "Provider bid: ~30–90 sec" */
  bidWaitLabel: string;
  /** Full on-chain flow, e.g. "Full setup: ~1–3 min" */
  setupLabel: string;
  /** Max minutes to expect for provider bid (for progress UI) */
  bidMaxMinutes: number;
  tone: RentWaitTone;
};

export function estimateRentWait(input: {
  isOnline: boolean;
  /** Console reports free GPU slots on this host. */
  hasGpuCapacity?: boolean;
  hasLcdSpot: boolean;
  providerOwner: string;
  /** Provider has open LCD GPU orders on Akash market (bid bot likely active). */
  marketActive?: boolean;
  /** First rental needs BME mint (~1–3 min extra). */
  needsMint?: boolean;
}): RentWaitEstimate {
  const owner = input.providerOwner.trim().toLowerCase();
  const mintExtra = input.needsMint ? " (+2–3 min first-time ACT mint)" : "";

  if (!input.isOnline) {
    return {
      badge: "Offline",
      bidWaitLabel: "Provider bid: unavailable",
      setupLabel: "Host offline — pick another card",
      bidMaxMinutes: 0,
      tone: "offline",
    };
  }

  if (input.hasGpuCapacity === false) {
    return {
      badge: "Fully booked",
      bidWaitLabel: "Provider bid: unlikely",
      setupLabel: "No free GPU on this host — pick another card",
      bidMaxMinutes: 0,
      tone: "offline",
    };
  }

  const lowReliability = LOW_BID_RELIABILITY_PROVIDERS.has(owner);
  const marketActive = input.marketActive === true;
  const hasLcdSpot = input.hasLcdSpot;

  if (marketActive || hasLcdSpot) {
    return {
      badge: "Usually under 1 min",
      bidWaitLabel: "Provider bid: ~20–60 sec",
      setupLabel: `Full setup: ~1 min${mintExtra}`,
      bidMaxMinutes: 1,
      tone: "fast",
    };
  }

  if (lowReliability) {
    return {
      badge: "Up to 3 min",
      bidWaitLabel: "Provider bid: up to ~3 min (host often slow)",
      setupLabel: `Full setup: ~2–4 min${mintExtra} · try another provider if it fails`,
      bidMaxMinutes: 3,
      tone: "slow",
    };
  }

  return {
    badge: "Up to ~2 min",
    bidWaitLabel: "Provider bid: up to ~2 min (auto-retries)",
    setupLabel: `Full setup: ~1–3 min${mintExtra}`,
    bidMaxMinutes: 2,
    tone: "moderate",
  };
}

export function rentWaitToneClass(tone: RentWaitTone): string {
  switch (tone) {
    case "fast":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200/80";
    case "moderate":
      return "bg-sky-100 text-sky-900 ring-sky-200/80";
    case "slow":
      return "bg-amber-100 text-amber-950 ring-amber-200/80";
    case "offline":
      return "bg-slate-100 text-slate-600 ring-slate-200/80";
  }
}

/** Build provider → active on LCD market from marketplace API payload. */
export function marketActiveProvidersFromOrders(
  orders: unknown[],
  providersByOwner?: Record<string, ProviderGpuModel[]>,
): Set<string> {
  const cards = ordersToOfferCards(orders, 80, providersByOwner);
  const active = new Set<string>();
  for (const card of cards) {
    if (!card.providerOwner || !card.hasGpu || card.state !== "open") continue;
    active.add(card.providerOwner.toLowerCase());
  }
  return active;
}
