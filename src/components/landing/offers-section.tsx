"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";

export function OffersSection() {
  return (
    <section className="relative z-10 border-y border-border-accent bg-surface-band py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-6 border-l-4 border-accent pl-6 sm:flex-row sm:items-end sm:justify-between sm:pl-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
              Marketplace
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
              Live Akash spot bids
            </h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-text-secondary">
              Real GPU, CPU, and memory specs with per-block pricing from the Akash mainnet
              LCD — refreshed on every load.
            </p>
          </div>
          <Button variant="secondary" className="shrink-0" asChild>
            <Link href="/login">Unlock to reserve</Link>
          </Button>
        </div>

        <div className="mt-12">
          <LiveAkashOffers
            reserveHref="/login"
            reserveLabel="Unlock to reserve"
            limit={6}
            showSource={false}
          />
        </div>
      </div>
    </section>
  );
}
