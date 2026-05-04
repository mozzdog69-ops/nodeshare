import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { ComputeNetworkMap } from "@/components/network/compute-network-map";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Network",
  description: "Browse decentralized GPU capacity on the NodeShare mesh.",
};

export default function PublicNetworkPage() {
  return (
    <div className="min-h-screen bg-surface-base">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-border-subtle px-6 py-5">
        <NodeShareLogo size="nav" href="/" />
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Unlock console</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          Compute network
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Public view of the mesh — unlock your wallet to reserve capacity and stream
          jobs.
        </p>
        <div className="mt-8">
          <ComputeNetworkMap />
        </div>
      </main>
    </div>
  );
}
