import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";
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
          <strong className="font-medium text-text-primary">Live Akash bids</strong>{" "}
          pulled from a public LCD (same feed as the dashboard). Reserve capacity, fund your
          wallet, then attach workloads from the terminal after you clear the balance gate.
        </p>
        <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Live spot bids
        </h2>
        <div className="mt-4">
          <LiveAkashOffers
            reserveHref="/app/terminal"
            reserveLabel="Use with terminal"
            offerQueryParam
            limit={12}
            showSource={false}
          />
        </div>
      </div>
    </div>
  );
}
