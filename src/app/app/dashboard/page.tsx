import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardLiveBalances } from "@/components/dashboard/dashboard-live-balances";
import { DashboardLiveStats } from "@/components/dashboard/dashboard-live-stats";
import { MeshStatusBadge } from "@/components/dashboard/mesh-status-badge";
import { LiveAkashOffers } from "@/components/marketplace/live-akash-offers";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle bg-white px-6 py-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent">Console</p>
          <h1 className="text-lg font-bold text-text-primary">Dashboard</h1>
        </div>
        <MeshStatusBadge />
      </header>
      <div className="flex-1 space-y-8 bg-surface-subtle p-6">
        <section className="rounded-[var(--radius-lg)] border border-border-subtle bg-white p-6 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
            On-chain balances
          </h2>
          <p className="mt-1 text-sm text-text-muted">ETH · USDC · USDT (live via Netlify API)</p>
          <div className="mt-4">
            <DashboardLiveBalances />
          </div>
        </section>

        <DashboardLiveStats />

        <div className="flex flex-col items-stretch justify-between gap-6 rounded-[var(--radius-lg)] border-2 border-accent bg-surface-accent p-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-accent">Next step</p>
            <p className="mt-1 text-lg font-bold text-text-primary">Reserve spot GPUs</p>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              Browse live Akash bids, fund your wallet, then open the terminal once balances
              clear the gate.
            </p>
          </div>
          <Button className="shrink-0 px-8 py-4 text-base" asChild>
            <Link href="/app/marketplace">Open marketplace</Link>
          </Button>
        </div>

        <section className="rounded-[var(--radius-lg)] border border-border-subtle bg-white p-6 shadow-card">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
                Rent a GPU
              </h2>
              <p className="mt-1 max-w-xl text-sm text-text-secondary">
                Live Akash bids from mainnet: GPU specs, per-block rate, and an hourly estimate (~6s
                blocks). Same feed as the marketplace — pick a card, then use the terminal after you
                fund.
              </p>
            </div>
            <Button variant="secondary" className="shrink-0" asChild>
              <Link href="/app/marketplace">Browse all offers</Link>
            </Button>
          </div>
          <LiveAkashOffers
            reserveHref="/app/terminal"
            reserveLabel="Use with terminal"
            offerQueryParam
            limit={6}
            showSource={false}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <ActivityFeed />
          <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-white p-6 shadow-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-accent">Terminal</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Balance-gated shell — fund ETH or USDC/USDT, then stream logs from the mesh.
            </p>
            <Button variant="secondary" className="mt-4" asChild>
              <Link href="/app/terminal">Open terminal</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
