"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  COMPUTE_OFFERS,
  formatOfferCountdown,
} from "@/data/compute-offers";

type Props = {
  /** Where primary CTA links (e.g. `/login` on marketing, `/app/run-job` in console). */
  reserveHref: string;
  reserveLabel?: string;
  /** Append `?offer=` for deep-linking when reserveHref is run-job. */
  offerQueryParam?: boolean;
};

export function ComputeOffersGrid({
  reserveHref,
  reserveLabel = "Reserve",
  offerQueryParam = false,
}: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setElapsedSec((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {COMPUTE_OFFERS.map((o, i) => {
        const remaining = Math.max(0, o.endsInSec - elapsedSec);
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
                    {formatOfferCountdown(remaining)}
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
                  {o.slots} open slots · mesh verified
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
  );
}
