"use client";

import { apiUrl } from "@/lib/api-base";
import { useWalletSession } from "@/context/wallet-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type TransferRow = {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  symbol: string;
  value: string;
  decimals: number;
};

function fmtTime(ms: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ms));
  } catch {
    return String(ms);
  }
}

export function LiveJobHistory() {
  const { ethAddress } = useWalletSession();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ethAddress) return;
    setErr(null);
    const res = await fetch(
      apiUrl(`/api/chain/transactions?address=${encodeURIComponent(ethAddress)}`),
    );
    const j = (await res.json()) as {
      ok: boolean;
      data?: { transfers?: TransferRow[] };
      error?: string;
    };
    if (j.ok && j.data?.transfers) setRows(j.data.transfers);
    else {
      setRows([]);
      setErr(j.error ?? "Could not load transfers");
    }
  }, [ethAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ethAddress) {
    return (
      <p className="text-sm text-text-muted">
        Unlock your wallet to see live USDC/USDT payment activity (Etherscan-backed).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-sm text-text-secondary">
          Job escrow on Akash is tracked on-chain separately; here we show{" "}
          <strong className="font-medium text-text-primary">
            live ERC-20 stablecoin transfers
          </strong>{" "}
          for your Ethereum address (proxy for funding / payouts).
        </p>
        <Button variant="ghost" className="text-xs shrink-0" type="button" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      {err ? (
        <p className="text-sm text-amber-800">{err}</p>
      ) : null}
      {rows.length === 0 && !err ? (
        <p className="text-sm text-text-muted">No recent USDC/USDT transfers.</p>
      ) : null}
      {rows.map((t) => {
        const inflow = t.to.toLowerCase() === ethAddress.toLowerCase();
        const amt = Number(t.value) / 10 ** t.decimals;
        return (
          <Card key={t.hash} interactive>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    {t.symbol}
                  </span>
                  <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
                    {inflow ? "Receive" : "Send"}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-text-muted">
                  {fmtTime(t.timestamp)} ·{" "}
                  <a
                    className="text-accent hover:underline"
                    href={`https://etherscan.io/tx/${t.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.hash.slice(0, 12)}…
                  </a>
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  {inflow ? "From" : "To"} {inflow ? t.from : t.to}
                </p>
              </div>
              <div className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                {inflow ? "+" : "−"}
                {amt.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
