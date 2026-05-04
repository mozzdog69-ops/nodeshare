"use client";

import { useWalletSession } from "@/context/wallet-session";

function shortAddr(a: string | null) {
  if (!a) return "—";
  if (a.length <= 14) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

export function WalletAddresses() {
  const { ethAddress, aktAddress } = useWalletSession();

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated shadow-card">
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Ethereum
          </p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-text-primary">
            {ethAddress ?? "—"}
          </p>
        </div>
      </div>
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated shadow-card">
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Akash (AKT)
          </p>
          <p className="mt-2 break-all font-mono text-sm font-semibold text-text-primary">
            {aktAddress ?? "—"}
          </p>
        </div>
      </div>
      <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated shadow-card">
        <div className="border-b border-border-subtle px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Session
          </p>
          <p className="mt-2 font-mono text-sm text-text-secondary">
            Unlocked · {shortAddr(ethAddress)}
          </p>
        </div>
      </div>
    </div>
  );
}
