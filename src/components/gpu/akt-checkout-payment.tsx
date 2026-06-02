"use client";

import type { RentWaitEstimate } from "@/lib/akash/rent-wait-estimate";
import { formatAktDisplay } from "@/lib/gpu/quote-utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  aktAddress: string;
  aktFormatted: string | null;
  aktBalance: number | null;
  payAmount: number;
  loading?: boolean;
  waitEstimate?: RentWaitEstimate | null;
};

function shortAkash(addr: string) {
  return `${addr.slice(0, 12)}…${addr.slice(-8)}`;
}

/** Confirms one-click rent debits the unlocked NodeShare Akash wallet — not Ethereum or external wallets. */
export function AktCheckoutPayment({
  aktAddress,
  aktFormatted,
  aktBalance,
  payAmount,
  loading,
  waitEstimate,
}: Props) {
  const sufficient =
    payAmount > 0 &&
    aktBalance != null &&
    Number.isFinite(payAmount) &&
    aktBalance + 1e-9 >= payAmount;
  const remaining =
    aktBalance != null && payAmount > 0 ? Math.max(0, aktBalance - payAmount) : null;

  return (
    <Card className="border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white">
      <CardHeader className="pb-2">
        <h2 className="text-sm font-semibold">Pay with NodeShare AKT balance</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-text-secondary">
          Rental is paid in <span className="font-semibold text-text-primary">AKT</span> from your
          unlocked NodeShare Akash wallet. No Ethereum USDC, no external wallet pop-up — the app
          signs the Akash transfer locally with your recovery phrase.
        </p>
        <dl className="grid gap-2 rounded-lg border border-border-subtle bg-white/90 p-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Pay from</dt>
            <dd className="truncate font-mono text-right text-text-primary">{shortAkash(aktAddress)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Your balance</dt>
            <dd className="font-mono font-semibold tabular-nums text-text-primary">
              {loading ? "…" : aktFormatted ?? (aktBalance != null ? formatAktDisplay(aktBalance) : "—")}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border-subtle pt-2">
            <dt className="font-semibold text-text-primary">Charge</dt>
            <dd className="font-mono text-base font-bold tabular-nums text-accent">
              {formatAktDisplay(payAmount)}
            </dd>
          </div>
          {remaining != null && sufficient ? (
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Balance after</dt>
              <dd className="font-mono tabular-nums text-emerald-800">{formatAktDisplay(remaining)}</dd>
            </div>
          ) : null}
        </dl>
        {!sufficient && payAmount > 0 && !loading ? (
          <p className="text-xs font-medium text-rose-800">
            Not enough AKT on this wallet. Send AKT to{" "}
            <span className="font-mono">{shortAkash(aktAddress)}</span>, then refresh balance above.
          </p>
        ) : sufficient ? (
          <div className="space-y-1 text-xs font-medium text-emerald-800">
            <p>Ready — tap below to sign the AKT payment from this wallet.</p>
            {waitEstimate ? (
              <p className="font-normal text-emerald-900/90">
                Expected after pay: {waitEstimate.bidWaitLabel} · {waitEstimate.setupLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
