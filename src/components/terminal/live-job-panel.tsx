"use client";

import Link from "next/link";

/**
 * Placeholder until provider log streaming is wired. No simulated costs or fake job lines.
 */
export function LiveJobPanel({ aktAddress }: { aktAddress: string }) {
  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Session side panel
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Marketplace and dashboard pull <span className="font-medium">live open orders</span>{" "}
          from Akash REST/LCD (same feeds as akash net / api.akashnet.net). This shell does
          not run a card or custodial payment gateway — spend by funding{" "}
          <span className="font-mono text-xs">AKT</span> on your Akash address.
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 p-4 text-sm text-text-muted">
        <p>
          Reserve capacity from the{" "}
          <Link href="/app/marketplace" className="font-medium text-accent underline-offset-2 hover:underline">
            Marketplace
          </Link>
          , pay leases in <span className="font-medium text-text-secondary">AKT</span> (and
          USDC bids where providers support it on-chain), then use Akash CLI / Console for
          manifests and log streams.
        </p>
        <p className="break-all font-mono text-[11px] text-text-muted/90">{aktAddress}</p>
      </div>
    </div>
  );
}
