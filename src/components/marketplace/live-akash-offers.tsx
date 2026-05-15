"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchApiJson } from "@/lib/fetch-api";
import { ordersToOfferCards, type OfferCard } from "@/lib/akash/summarize";

type Props = {
  reserveHref: string;
  reserveLabel?: string;
  offerQueryParam?: boolean;
  limit?: number;
  /** Show raw LCD URL (off by default on marketing pages). */
  showSource?: boolean;
};

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
            ? ` Last tries: ${j.data.attempts.slice(-3).join(" · ")}`
            : "";
        setErr((j.error ?? "Could not load Akash market") + tail);
        return;
      }

      const orders = Array.isArray(j.data?.orders) ? j.data!.orders : [];
      setSource(j.data?.source ?? null);
      setCards(ordersToOfferCards(orders, limit));
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
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-elevated px-4 py-6 text-sm text-text-muted shadow-card">
        <span
          className="inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden
        />
        Loading live Akash open orders…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-card">
        <p className="font-medium">Could not load market feed</p>
        <p className="text-amber-900/90">{err}</p>
        <p className="text-xs text-amber-800/90">
          On Netlify, set <code className="rounded bg-white/80 px-1 font-mono text-[11px]">AKASH_LCD_URL</code> to{" "}
          <code className="rounded bg-white/80 px-1 font-mono text-[11px]">https://api.akashnet.net</code> if needed.
        </p>
        <button
          type="button"
          className="font-semibold text-accent underline"
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-elevated px-4 py-6 text-sm text-text-secondary shadow-card">
        <p className="font-medium text-text-primary">No open orders on this snapshot</p>
        <p className="mt-1 text-xs text-text-muted">
          The LCD responded successfully but returned zero open orders.
        </p>
        <Button variant="ghost" className="mt-3 h-9 px-2 text-xs" type="button" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-live" />
          </span>
          {cards.length} live open order{cards.length === 1 ? "" : "s"} · Akash mainnet
        </p>
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>

      {showSource && source ? (
        <p className="mb-4 font-mono text-[10px] text-text-muted break-all opacity-70">
          {source}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((o, i) => {
          const href = offerQueryParam
            ? `${reserveHref}?offer=${encodeURIComponent(o.id)}`
            : reserveHref;
          return (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card interactive className="h-full border-border-subtle bg-surface-elevated">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {o.badge}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-text-muted">
                      <span className="size-1.5 rounded-full bg-live" aria-hidden />
                      Live
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold leading-snug text-text-primary">
                    {o.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium text-text-primary">{o.gpu}</p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    {o.resources}
                  </p>
                  <p className="mt-4 font-mono text-xl font-semibold tabular-nums text-accent">
                    {o.price}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">{o.priceNote}</p>
                  <p className="mt-2 font-mono text-[10px] text-text-muted">{o.orderRef}</p>
                  <Button className="mt-5 w-full" asChild>
                    <Link href={href}>{reserveLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
