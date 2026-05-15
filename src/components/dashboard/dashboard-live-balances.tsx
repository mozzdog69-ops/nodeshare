"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { friendlyRpcError } from "@/lib/chain/rpc-url";
import { useWalletSession } from "@/context/wallet-session";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Bal = {
  chainId: number;
  native: { balance: string };
  usdc: { balance: string };
  usdt: { balance: string };
};

function fmt(n: string) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function DashboardLiveBalances() {
  const { ethAddress } = useWalletSession();
  const [data, setData] = useState<Bal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ethAddress) return;
    const got = await fetchApiJson<{
      ok: boolean;
      data?: Bal;
      error?: string;
    }>(`/api/chain/balances?address=${encodeURIComponent(ethAddress)}`);
    if (!got.ok) {
      setData(null);
      setErr(friendlyRpcError(got.error));
      return;
    }
    const j = got.body;
    if (j.ok && j.data) {
      setData(j.data);
      setErr(null);
    } else {
      setData(null);
      setErr(friendlyRpcError(j.error ?? "Could not load balances"));
    }
  }, [ethAddress]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [load]);

  if (!ethAddress) return null;

  return (
    <div>
      {err ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {err}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "USDC (live)", value: data ? fmt(data.usdc.balance) : "…", em: true },
          { label: "USDT (live)", value: data ? fmt(data.usdt.balance) : "…" },
          { label: "ETH gas (live)", value: data ? fmt(data.native.balance) : "…" },
        ].map((c) => (
          <div
            key={c.label}
            className={cn(
              "rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-4 py-3 shadow-card",
              c.em && "border-accent/20 ring-1 ring-accent/10",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {c.label}
            </p>
            <p
              className={cn(
                "mt-1 font-mono text-lg font-semibold tabular-nums text-text-primary",
                c.em && "text-accent",
              )}
            >
              {c.value}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {data ? `Chain ${data.chainId}` : "Loading…"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
