import { ConsoleGpuOffers } from "@/components/marketplace/console-gpu-offers";
import { GpuBackendOffers } from "@/components/marketplace/gpu-backend-offers";
import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";
import { NodeShareAktWalletCard } from "@/components/wallet/nodeshare-akt-wallet-card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function MarketplacePage() {
  return (
    <div className="flex flex-1 flex-col bg-surface-subtle">
      <header className="border-b border-border-subtle bg-white px-6 py-5">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Marketplace</p>
        <h1 className="mt-1 text-xl font-bold text-text-primary">Rent Akash GPU with AKT</h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Pick an exact GPU model below (RTX 4090, A100, etc.). Checkout pays with AKT from your NodeShare{" "}
          <span className="font-mono text-xs">akash1…</span> wallet — burns AKT to mint ACT escrow on-chain
          for deployment, lease, and manifest — no treasury or provisioning API required.
        </p>
      </header>
      <div className="space-y-8 p-6">
        <NodeShareAktWalletCard compact />
        <ConsoleGpuOffers limit={24} />
        <GpuBackendOffers />
        <LiveAkashOffers
          reserveHref="/app/marketplace/checkout"
          reserveLabel="Rent GPU with AKT"
          offerQueryParam
          limit={12}
          showSource={false}
          namedGpuOnly
        />
      </div>
    </div>
  );
}
