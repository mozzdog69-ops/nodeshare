import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplacePage() {
  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      <header className="border-b border-border-subtle bg-surface-elevated/90 px-6 py-5 backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Marketplace</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-text-primary">
          Live Akash compute
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Spot bids from Akash mainnet. Fund your wallet, then attach workloads from the terminal
          after balances clear the gate.
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
