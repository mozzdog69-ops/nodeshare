import { DashboardLiveStats } from "@/components/dashboard/dashboard-live-stats";
import { MeshStatusBadge } from "@/components/dashboard/mesh-status-badge";
import { NodeShareAktWalletCard } from "@/components/wallet/nodeshare-akt-wallet-card";
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
      <div className="flex-1 space-y-6 bg-surface-subtle p-6">
        <NodeShareAktWalletCard />
        <DashboardLiveStats />
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/app/marketplace">Browse GPUs to rent</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
