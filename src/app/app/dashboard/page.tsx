import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { DashboardLiveBalances } from "@/components/dashboard/dashboard-live-balances";
import { LiveOpsPanel } from "@/components/dashboard/live-ops-panel";
import { StatRow } from "@/components/dashboard/stat-row";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Dashboard</h1>
        <span className="rounded-full border border-success-muted bg-success-muted px-3 py-1 text-xs font-medium text-success">
          Network healthy
        </span>
      </header>
      <div className="flex-1 space-y-8 p-6">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            On-chain balances (ETH / USDC / USDT)
          </h2>
          <DashboardLiveBalances />
        </section>

        <StatRow
          stats={[
            { label: "Active jobs", value: "2", hint: "1 training · 1 inference" },
            { label: "GPU hours (30d)", value: "128.4", hint: "Across Akash + Render" },
            { label: "Nodes online", value: "128", hint: "Decentralized mesh" },
          ]}
        />

        <div className="flex flex-col items-stretch justify-between gap-6 rounded-[var(--radius-lg)] border border-dashed border-accent/25 bg-gradient-to-br from-accent-muted/50 to-transparent p-8 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Next action
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
              Launch a compute job
            </p>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
              Reserve GPUs, lock payment in escrow, stream logs from the mesh.
            </p>
          </div>
          <Button className="shrink-0 px-8 py-4 text-base shadow-lg" asChild>
            <Link href="/app/run-job">Launch compute job</Link>
          </Button>
        </div>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Live infrastructure
          </h2>
          <LiveOpsPanel />
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <ActivityFeed />
          <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated p-5 shadow-card">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Terminal
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              The core experience — dark island inside a light console. Full GPU
              control from a shell you trust.
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
