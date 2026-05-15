"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";

export function OffersSection() {
  return (
    <section className="relative z-10 border-t border-border-subtle bg-surface-band py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Live offers
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              Spot capacity on the mesh
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
              Open orders from the Akash mainnet LCD — GPU, CPU, memory, and block
              rates pulled live (no placeholder inventory).
            </p>
          </div>
          <Button variant="secondary" className="shrink-0" asChild>
            <Link href="/login">Unlock to reserve</Link>
          </Button>
        </div>

        <div className="mt-10">
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
