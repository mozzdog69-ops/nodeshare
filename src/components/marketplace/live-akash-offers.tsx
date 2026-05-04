"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiUrl } from "@/lib/api-base";
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
  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(apiUrl(`/api/akash/market?limit=${limit}`));
    const j = (await res.json()) as {
      ok: boolean;
      data?: { orders: unknown[]; source?: string };
      error?: string;
    };
    if (!j.ok || !j.data?.orders) {
      setCards([]);
      setSource(null);
      setErr(j.error ?? "Could not load Akash market");
      return;
    }
    setSource(j.data.source ?? null);
    setCards(ordersToOfferCards(j.data.orders, limit));
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  if (err) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {err}{" "}
        <button
          type="button"
          className="font-medium text-accent underline"
          onClick={() => void load()}
        >
          Retry
        </button>
      </p>
    );
  }

  if (cards.length === 0 && !err) {
    return (
      <p className="text-sm text-text-muted">
        Loading open orders from Akash LCD…
      </p>
    );
  }

  return (
    <div>
      {source ? (
        <p className="mb-4 font-mono text-[11px] text-text-muted">
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
