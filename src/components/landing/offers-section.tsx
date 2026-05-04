"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ComputeOffersGrid } from "@/components/marketplace/compute-offers-grid";

export function OffersSection() {
  return (
    <section className="relative z-10 border-y border-border-subtle bg-surface-elevated/50 py-16 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Live offers
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
              Spot capacity on the mesh
            </h2>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">
              Browse spot GPUs — after you unlock, reserve from Run job or the
              Marketplace tab in the console.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/login">Unlock to reserve</Link>
          </Button>
        </div>

        <div className="mt-10">
          <ComputeOffersGrid reserveHref="/login" reserveLabel="Unlock to reserve" />
        </div>
      </div>
    </section>
  );
}
