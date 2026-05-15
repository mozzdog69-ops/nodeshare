"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AkashMarketTrustBar } from "@/components/marketplace/akash-market-trust-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchApiJson } from "@/lib/fetch-api";
import { ordersToOfferCards, type OfferCard } from "@/lib/akash/summarize";
import { cn } from "@/lib/utils";

type Props = {
  reserveHref: string;
  reserveLabel?: string;
  offerQueryParam?: boolean;
  limit?: number;
  showSource?: boolean;
};

function OfferSkeleton() {
  return (
    <div className="h-full animate-pulse rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated p-5 shadow-card">
      <motion.div className="h-4 w-20 rounded-full bg-surface-base" />
      <div className="mt-4 h-5 w-3/4 rounded bg-surface-base" />
      <motion.div className="mt-3 h-4 w-1/2 rounded bg-surface-base" />
      <motion.div className="mt-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-surface-base" />
        <div className="h-6 w-16 rounded-full bg-surface-base" />
      </motion.div>
      <div className="mt-6 h-8 w-28 rounded bg-surface-base" />
    </div>
  );
}

function ResourceChip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        highlight
          ? "border-accent/25 bg-accent-muted text-accent"
          : "border-border-subtle bg-surface-base text-text-secondary",
      )}
    >
      {label}
    </span>
  );
}

function OfferCardView({
  o,
  href,
  reserveLabel,
  index,
}: {
  o: OfferCard;
  href: string;
  reserveLabel: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <Card
        interactive
        className={cn(
          "h-full overflow-hidden border-border-subtle bg-surface-elevated shadow-card transition-shadow hover:shadow-card-hover",
          o.hasGpu && "ring-1 ring-accent/10",
        )}
      >
        <CardContent className="flex h-full flex-col p-0">
          <div
            className={cn(
              "border-b border-border-subtle px-5 py-3",
              o.hasGpu ? "bg-gradient-to-r from-accent-muted/80 to-transparent" : "bg-surface-base/50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent shadow-sm ring-1 ring-accent/15">
                {o.badge}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-live">
                <span className="size-1.5 rounded-full bg-live" aria-hidden />
                Live
              </span>
            </div>
          </div>

          <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
            <h3 className="text-base font-semibold leading-snug tracking-tight text-text-primary">
              {o.title}
            </h3>
            <p className="mt-1 font-mono text-[10px] text-text-muted">
              Provider {o.provider}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.resourceChips.map((chip) => (
                <ResourceChip key={chip} label={chip} highlight={chip.includes("GPU") || chip.includes("NVIDIA")} />
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-border-subtle bg-surface-base/80 px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Spot rate
              </p>
              <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-accent">
                {o.price}
              </p>
              <p className="mt-0.5 text-[11px] text-text-secondary">{o.priceNote}</p>
              {o.priceMonthly ? (
                <p className="mt-2 border-t border-border-subtle pt-2 text-xs font-medium text-text-primary">
                  {o.priceMonthly}
                </p>
              ) : null}
            </div>

            <p className="mt-3 font-mono text-[10px] text-text-muted">{o.orderRef}</p>

            <Button className="mt-4 w-full" asChild>
              <Link href={href}>{reserveLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function LiveAkashOffers({
  reserveHref,
  reserveLabel = "Reserve",
  offerQueryParam = false,
  limit = 12,
  showSource = false,
}: Props) {
  const [cards, setCards] = useState<OfferCard[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const got = await fetchApiJson<{
        ok: boolean;
        data?: {
          orders?: unknown[];
          source?: string;
          attempts?: string[];
        };
        error?: string;
      }>(`/api/akash/market?limit=${limit}`);

      if (!got.ok) {
        setCards([]);
        setSource(null);
        setErr(got.error);
        return;
      }

      const j = got.body;
      if (!j.ok) {
        setCards([]);
        setSource(null);
        const tail =
          j.data?.attempts?.length && Array.isArray(j.data.attempts)
            ? ` Last tries: ${j.data.attempts.slice(-2).join(" · ")}`
            : "";
        setErr((j.error ?? "Could not load Akash market") + tail);
        return;
      }

      const orders = Array.isArray(j.data?.orders) ? j.data!.orders : [];
      setSource(j.data?.source ?? null);
      setCards(ordersToOfferCards(orders, limit));
      setUpdatedAt(Date.now());
      setErr(null);
    } catch (e) {
      setCards([]);
      setSource(null);
      setErr(e instanceof Error ? e.message : "Unexpected error loading market.");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <motion.div className="space-y-4">
      <AkashMarketTrustBar orderCount={loading ? undefined : cards.length} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
            <OfferSkeleton key={i} />
          ))}
        </div>
      ) : err ? (
        <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-card">
          <p className="font-semibold">Market feed unavailable</p>
          <p className="text-amber-900/90">{err}</p>
          <p className="text-xs text-amber-800/90">
            On Netlify, confirm deploy succeeded and optional{" "}
            <code className="rounded bg-white/80 px-1 font-mono text-[11px]">AKASH_LCD_URL</code> is{" "}
            <code className="rounded bg-white/80 px-1 font-mono text-[11px]">https://api.akashnet.net</code>
          </p>
          <button
            type="button"
            className="font-semibold text-accent underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-surface-elevated px-4 py-6 text-sm shadow-card">
          <p className="font-medium text-text-primary">No open orders on this snapshot</p>
          <p className="mt-1 text-xs text-text-muted">
            The Akash LCD responded but returned zero open orders for this page.
          </p>
          <Button variant="ghost" className="mt-3 h-9 px-2 text-xs" type="button" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>
              {cards.length} live open order{cards.length === 1 ? "" : "s"} · prices from Akash mainnet LCD
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

          {showSource && source ? (
            <p className="font-mono text-[10px] text-text-muted break-all opacity-60">{source}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((o, i) => {
              const href = offerQueryParam
                ? `${reserveHref}?offer=${encodeURIComponent(o.id)}`
                : reserveHref;
              return (
                <OfferCardView
                  key={o.id}
                  o={o}
                  href={href}
                  reserveLabel={reserveLabel}
                  index={i}
                />
              );
            })}
          </div>

          <p className="text-center text-[11px] text-text-muted">
            Spot rates are on-chain bid prices per block. Monthly figures are estimates (~6s blocks) — confirm on
            Akash before deploying production workloads.
          </p>
        </>
      )}
    </motion.div>
  );
}
