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
};

export function LiveAkashOffers({
  reserveHref,
  reserveLabel = "Reserve",
  offerQueryParam = false,
  limit = 12,
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
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <span
          className="inline-block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
          aria-hidden
        />
        Fetching Akash market…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p>{err}</p>
        <p className="text-xs text-amber-800/90">
          Tip: set{" "}
          <code className="rounded bg-white/80 px-1 font-mono text-[11px]">
            AKASH_LCD_URL
          </code>{" "}
          on your API host to a REST endpoint from the{" "}
          <a
            className="font-medium text-accent underline"
            href="https://github.com/cosmos/chain-registry/blob/master/akash/chain.json"
            target="_blank"
            rel="noreferrer"
          >
            Akash chain-registry
          </a>{" "}
          REST list.
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
      <div className="rounded-lg border border-border-subtle bg-surface-elevated px-4 py-4 text-sm text-text-secondary shadow-card">
        <p className="font-medium text-text-primary">No open bids on this snapshot</p>
        <p className="mt-1 text-xs text-text-muted">
          The LCD responded but returned zero orders (quiet market or pagination).
        </p>
        <Button variant="ghost" className="mt-3 h-9 px-2 text-xs" type="button" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div>
      {source ? (
        <p className="mb-4 font-mono text-[11px] text-text-muted break-all">
          Source: {source}
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
              <Card interactive className="h-full">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {o.badge}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-text-muted">
                      Live
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-text-primary">
                    {o.title}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">{o.gpu}</p>
                  <p className="mt-4 font-mono text-lg font-semibold text-accent">
                    {o.price}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Open bid · Akash LCD
                  </p>
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
