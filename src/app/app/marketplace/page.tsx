import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplacePage() {
  return (
    <div className="flex flex-1 flex-col bg-surface-subtle">
      <header className="border-b border-border-subtle bg-white px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Marketplace</p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">Live Akash compute</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Spot bids from mainnet — fund your wallet, then attach workloads from the terminal.
        </p>
      </header>
      <div className="p-6">
        <LiveAkashOffers
          reserveHref="/app/terminal"
          reserveLabel="Use with terminal"
          offerQueryParam
          limit={12}
          showSource={false}
        />
      </div>
    </div>
  );
}
