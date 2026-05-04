import { ComputeOffersGrid } from "@/components/marketplace/compute-offers-grid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplacePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Marketplace</h1>
      </header>
      <div className="p-6">
        <p className="max-w-2xl text-sm text-text-secondary">
          <strong className="font-medium text-text-primary">Run job</strong> is where
          you pick a <em>workflow</em> (image, LLM, training, Docker).{" "}
          <strong className="font-medium text-text-primary">Marketplace</strong> is
          where you browse <em>spot inventory</em> — same offers surface on Run job so
          you can attach capacity without hunting.
        </p>
        <p className="mt-3 max-w-2xl text-xs text-text-muted">
          Mock data for now; wire to your pricing API or Akash bid stream later.
        </p>
        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Live spot offers
        </h2>
        <div className="mt-4">
          <ComputeOffersGrid
            reserveHref="/app/run-job"
            reserveLabel="Use in Run job"
            offerQueryParam
          />
        </div>
      </div>
    </div>
  );
}
