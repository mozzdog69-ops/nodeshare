import { ComputeNetworkMap } from "@/components/network/compute-network-map";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compute network",
};

export default function NetworkPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Compute network</h1>
      </header>
      <div className="flex-1 p-6">
        <p className="mb-6 max-w-2xl text-sm text-text-secondary">
          Decentralized AWS map — Akash clusters, Render fallbacks, latency-aware
          routing. Click nodes to inspect economics.
        </p>
        <ComputeNetworkMap />
      </div>
    </div>
  );
}
