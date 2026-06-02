"use client";

import { ActCreditsBanner } from "@/components/gpu/act-credits-banner";
import { useLiveAktBalance } from "@/hooks/use-live-akt-balance";
import { formatAktDisplay, aktTopUpNeeded } from "@/lib/gpu/quote-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Rental total in AKT — compared against live wallet balance. */
  requiredAkt?: number;
  requiredHint?: string;
  compact?: boolean;
  className?: string;
  /** Share one LCD poll between parent + card (e.g. checkout). */
  balanceState?: ReturnType<typeof useLiveAktBalance>;
};

function shortAkash(addr: string) {
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

export function NodeShareAktWalletCard({
  requiredAkt = 0,
  requiredHint,
  compact = false,
  className,
  balanceState,
}: Props) {
  const internal = useLiveAktBalance(balanceState ? 0 : 45_000);
  const {
    aktAddress,
    aktBalance,
    actBalance,
    aktFormatted,
    actFormatted,
    loading,
    error,
    refresh,
    hasSufficientAkt,
    walletReady,
  } = balanceState ?? internal;
  const [copied, setCopied] = useState(false);

  const need = Number(requiredAkt) || 0;
  const sufficient = hasSufficientAkt(need);
  const topUp = aktTopUpNeeded(need, aktBalance);
  const showShortfall = need > 0 && walletReady && !loading && aktBalance != null && !sufficient;

  async function copyAddress() {
    if (!aktAddress) return;
    try {
      await navigator.clipboard.writeText(aktAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card
      className={cn(
        "border-sky-200/90 bg-gradient-to-br from-sky-50/95 via-white to-surface-subtle shadow-card",
        showShortfall && "border-amber-300/90 ring-1 ring-amber-200/60",
        sufficient && need > 0 && "border-emerald-200/90",
        className,
      )}
    >
      <CardContent className={cn("space-y-3", compact ? "p-4" : "p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-accent">
              NodeShare wallet · pay with AKT
            </p>
            <p className={cn("mt-1 font-semibold text-text-primary", compact ? "text-sm" : "text-base")}>
              GPU rental is paid from your imported Akash address
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-live shadow-sm ring-1 ring-live/20">
            <span className="size-1.5 rounded-full bg-live" aria-hidden />
            Live LCD
          </span>
        </div>

        {!walletReady ? (
          <p className="text-sm text-amber-900">
            {error ?? "Unlock your NodeShare wallet to load your AKT balance for GPU checkout."}
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-border-subtle/80 bg-white/90 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Your Akash address (send AKT here to fund rentals)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-text-primary sm:text-sm">
                {aktAddress}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => void copyAddress()}>
                  {copied ? "Copied" : "Copy address"}
                </Button>
                <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={loading} onClick={() => void refresh()}>
                  {loading ? "Refreshing…" : "Refresh balance"}
                </Button>
                <Button variant="ghost" className="h-8 px-2 text-xs" asChild>
                  <Link href="/app/wallet">Open wallet</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border-subtle bg-white/90 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Live AKT balance
                </p>
                <p
                  className={cn(
                    "mt-1 font-mono text-xl font-bold tabular-nums tracking-tight",
                    showShortfall ? "text-rose-700" : "text-emerald-800",
                  )}
                >
                  {loading ? "…" : aktFormatted ?? (aktBalance != null ? formatAktDisplay(aktBalance) : "—")}
                </p>
                {!compact && actBalance != null && actBalance > 0 ? (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    ACT compute credits:{" "}
                    <span className="font-mono font-semibold">{actFormatted ?? `${actBalance.toFixed(4)} ACT`}</span>
                  </p>
                ) : null}
                {!compact ? (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Pulled from Akash mainnet for{" "}
                    <span className="font-mono">{aktAddress ? shortAkash(aktAddress) : "—"}</span>
                  </p>
                ) : null}
              </div>

              {need > 0 ? (
                <div className="rounded-lg border border-border-subtle bg-white/90 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    Due from wallet now
                  </p>
                  <p className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-accent">
                    {formatAktDisplay(need)}
                  </p>
                  {requiredHint ? (
                    <p className="mt-1 text-[11px] text-text-secondary">{requiredHint}</p>
                  ) : null}
                  {showShortfall ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-800">
                      Short by {formatAktDisplay(topUp)} — send at least that much AKT to the address above,
                      then refresh.
                    </p>
                  ) : sufficient && !loading ? (
                    <p className="mt-1 text-[11px] font-medium text-emerald-800">Balance covers this rental.</p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!compact && actBalance != null && actBalance >= 0.5 ? (
              <ActCreditsBanner actBalance={actBalance} variant="wallet" />
            ) : null}
          </>
        )}

        {error && walletReady ? (
          <p className="text-xs text-amber-900">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
