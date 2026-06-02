"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GpuOfferPreview } from "@/components/gpu/gpu-offer-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  consoleProvidersToGpuCards,
  indexLcdOrdersByProvider,
  type ConsoleGpuOfferCard,
} from "@/lib/akash/console-gpu-catalog";
import { ordersToOfferCards } from "@/lib/akash/summarize";
import { fetchApiJson } from "@/lib/fetch-api";
import { GpuRentWaitBadge } from "@/components/gpu/gpu-rent-wait-badge";
import { estimateRentWait } from "@/lib/akash/rent-wait-estimate";
import { marketActiveProvidersFromOrders } from "@/lib/akash/rent-wait-estimate";
import { buildCheckoutSearchParams } from "@/lib/gpu/quote-utils";
import { cn } from "@/lib/utils";

function GpuCardSkeleton() {
  return (
    <div className="h-72 animate-pulse rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated" />
  );
}

function ConsoleGpuCard({
  card,
  index,
}: {
  card: ConsoleGpuOfferCard;
  index: number;
}) {
  const vramChip = card.vram ? `${card.vram} VRAM` : null;
  const ifaceChip = card.gpuInterface ? card.gpuInterface : null;
  const canRent = card.isOnline && card.hasGpuCapacity;
  const showSlowRentHint = canRent && card.fastRentEligible === false;
  const waitEstimate = estimateRentWait({
    isOnline: card.isOnline,
    hasGpuCapacity: card.hasGpuCapacity,
    hasLcdSpot: Boolean(card.pricePerBlock || card.lcdOrderId),
    providerOwner: card.providerOwner,
    marketActive: card.marketActive,
  });

  const checkoutQs = buildCheckoutSearchParams({
    offerId: card.id,
    title: card.gpuModel,
    provider: card.providerLabel,
    gpuLabel: card.gpuModel,
    gpuModelSlug: card.gpuModelSlug,
    gpuVram: card.vram,
    gpuInterface: card.gpuInterface,
    providerOwner: card.providerOwner,
    providerOnline: card.isOnline,
    gpuHasCapacity: card.hasGpuCapacity,
    fastRentEligible: true,
    lcdPriceAmount: card.lcdPriceAmount,
    lcdPriceDenom: card.lcdPriceDenom,
    lcdOrderId: card.lcdOrderId,
    basePriceAkt: card.basePriceAkt,
    basePriceUsd: card.basePriceUsd,
    priceHourly: card.priceHourly,
    pricePerBlock: card.pricePerBlock,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
    >
      <Card
        interactive={canRent}
        className={cn(
          "h-full overflow-hidden border-t-2 border-border-subtle bg-surface-elevated shadow-card",
          canRent
            ? "border-t-accent hover:shadow-card-hover"
            : "border-t-slate-300 opacity-75",
        )}
      >
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-accent px-4 py-2.5">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent ring-1 ring-accent/15">
              GPU for rent
            </span>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <GpuRentWaitBadge estimate={waitEstimate} />
              <span
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
                  canRent ? "text-live" : card.isOnline ? "text-amber-800" : "text-text-muted",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    canRent ? "bg-live" : card.isOnline ? "bg-amber-500" : "bg-text-muted",
                  )}
                  aria-hidden
                />
                {canRent ? "Online" : card.isOnline ? "Fully booked" : "Offline"}
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4">
            <GpuOfferPreview
              size="lg"
              gpuModel={card.gpuModel}
              title={card.gpuModel}
              hasGpu
              provider={card.providerLabel}
              region="Akash"
              priceHourly={card.priceHourly}
              resourceChips={[vramChip, ifaceChip].filter(Boolean) as string[]}
              className="mb-3"
            />

            <div className="mt-auto space-y-3">
              {card.pricePerBlock ? (
                <div className="rounded-lg border border-border-subtle bg-surface-base/80 px-3 py-2 text-xs">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    LCD spot (same provider)
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">{card.pricePerBlock}</p>
                </div>
              ) : card.priceHourly ? (
                <p className="text-xs text-text-secondary">
                  {card.priceHourly} · pay with AKT, escrow ACT on-chain at checkout.
                </p>
              ) : (
                <p className="text-xs text-text-secondary">
                  Pay with AKT at checkout — ACT escrowed on-chain for your chosen runtime.
                </p>
              )}

              <p className="text-[11px] text-text-secondary">
                {waitEstimate.bidWaitLabel} · {waitEstimate.setupLabel}
              </p>

              {showSlowRentHint ? (
                <p className="text-[11px] text-amber-900">
                  No LCD spot from this host — rent may take longer; cards with LCD spot price bid
                  faster.
                </p>
              ) : null}

              <p className="font-mono text-[10px] text-text-muted break-all">{card.providerOwner}</p>

              {canRent ? (
                <Button className="h-11 w-full" asChild>
                  <Link href={`/app/marketplace/checkout?${checkoutQs}`}>Rent GPU with AKT</Link>
                </Button>
              ) : (
                <Button className="h-11 w-full" type="button" disabled>
                  {!card.hasGpuCapacity
                    ? card.capacityLabel ?? "Fully booked — no free GPU"
                    : "Host offline — cannot rent"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ConsoleGpuOffers({ limit = 24 }: { limit?: number }) {
  const [cards, setCards] = useState<ConsoleGpuOfferCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [provRes, marketRes] = await Promise.all([
        fetchApiJson<{
          ok: boolean;
          data?: {
            providersByOwner?: Record<string, { vendor: string; model: string; ram?: string; interface?: string }[]>;
            providerMetaByOwner?: Record<
              string,
              { isOnline: boolean; gpuAvailable: number; gpuTotal: number }
            >;
          };
          error?: string;
        }>("/api/akash/providers"),
        fetchApiJson<{
          ok: boolean;
          data?: {
            orders?: unknown[];
            providersByOwner?: Record<string, { vendor: string; model: string; ram?: string }[]>;
          };
          error?: string;
        }>("/api/akash/market?limit=40"),
      ]);

      if (!provRes.ok) {
        throw new Error(provRes.error ?? "Could not load GPU providers.");
      }
      if (!provRes.body.ok) {
        throw new Error(provRes.body.error ?? "Could not load GPU providers.");
      }

      const providersByOwner = provRes.body.data?.providersByOwner ?? {};
      const metaByOwner = provRes.body.data?.providerMetaByOwner ?? {};
      const providers = Object.entries(providersByOwner).map(([owner, gpuModels]) => ({
        owner,
        gpuModels,
        isOnline: metaByOwner[owner]?.isOnline !== false,
      }));

      let lcdByProvider = new Map<string, ReturnType<typeof ordersToOfferCards>[0]>();
      let marketActiveProviders = new Set<string>();
      if (marketRes.ok && marketRes.body.ok) {
        const orders = marketRes.body.data?.orders ?? [];
        const lcdProviders = marketRes.body.data?.providersByOwner ?? providersByOwner;
        const lcdCards = ordersToOfferCards(orders, 40, lcdProviders);
        lcdByProvider = indexLcdOrdersByProvider(lcdCards);
        marketActiveProviders = marketActiveProvidersFromOrders(orders, lcdProviders);
      }

      const built = consoleProvidersToGpuCards({
        providers,
        providerMetaByOwner: metaByOwner,
        lcdByProvider,
        marketActiveProviders,
        limit: limit * 2,
      });

      const online = built.filter((c) => c.isOnline && c.hasGpuCapacity);
      const booked = built.filter((c) => c.isOnline && !c.hasGpuCapacity);
      const offline = built.filter((c) => !c.isOnline);
      setCards([...online, ...booked, ...offline].slice(0, limit + 12));
      setUpdatedAt(Date.now());
      if (built.length === 0) {
        setErr("No GPU providers returned from Akash Console API.");
      }
    } catch (e) {
      setCards([]);
      setErr(e instanceof Error ? e.message : "Failed to load GPU marketplace.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-accent/20 bg-gradient-to-br from-surface-accent via-white to-surface-subtle px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Rent GPU with AKT</p>
        <h2 className="mt-1 text-lg font-bold text-text-primary">Live Akash GPU providers</h2>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Exact GPU models from the Akash Console provider registry — RTX 4090, A100, H100, and more.
          Only cards marked <strong>Online</strong> can rent. Offline hosts are listed for reference but
          cannot bid on your order.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <GpuCardSkeleton key={i} />
          ))}
        </div>
      ) : err && cards.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
          <p className="font-semibold">GPU catalog unavailable</p>
          <p className="mt-1">{err}</p>
          <Button variant="ghost" className="mt-3 h-9 px-2 text-xs" type="button" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>
              {cards.length} GPU{cards.length === 1 ? "" : "s"} available to rent · Akash Console inventory
            </span>
            <div className="flex items-center gap-3">
              {updatedAt ? (
                <span className="font-mono tabular-nums">
                  Updated {new Date(updatedAt).toLocaleTimeString()}
                </span>
              ) : null}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => void load()}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, i) => (
              <ConsoleGpuCard key={card.id} card={card} index={i} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
