"use client";

import { useWalletSession } from "@/context/wallet-session";
import { akashTxExplorerUrl } from "@/lib/akash/direct-rent-steps";
import {
  closeOpenAkashDeployments,
  closeStuckAkashDeployment,
  type StuckAkashDeployment,
} from "@/lib/akash/stuck-deployments";
import type { LeasedAkashDeployment } from "@/lib/akash/fetch-lcd-stuck-deployments";
import { fetchApiJson } from "@/lib/fetch-api";
import { filterRecoverableLeasedDeployments } from "@/lib/akash/stuck-order-filter";
import { formatActDisplay, formatAktDisplay } from "@/lib/gpu/quote-utils";
import { readGlobalGpuJobs, readLocalGpuJobs } from "@/lib/gpu/job-storage";
import type { GpuJob } from "@/lib/gpu/types";
import { useLiveAktBalance } from "@/hooks/use-live-akt-balance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function shortAkash(addr: string) {
  return `${addr.slice(0, 12)}…${addr.slice(-6)}`;
}

export function StuckOrdersPanel() {
  const { identity, aktAddress, status } = useWalletSession();
  const aktWallet = useLiveAktBalance();
  const { refresh: refreshBalances, aktBalance, actBalance, aktFormatted, actFormatted } = aktWallet;

  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closingDseq, setClosingDseq] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [stuck, setStuck] = useState<StuckAkashDeployment[]>([]);
  const [leasedRaw, setLeasedRaw] = useState<LeasedAkashDeployment[]>([]);
  const [lastTxHash, setLastTxHash] = useState("");

  const localJobs: GpuJob[] = aktAddress
    ? ([
        ...(readLocalGpuJobs(aktAddress) as GpuJob[]),
        ...(readGlobalGpuJobs() as GpuJob[]),
      ] as GpuJob[])
    : [];

  const leased = filterRecoverableLeasedDeployments(leasedRaw, localJobs);

  const totalEscrowAct = [...stuck, ...leased].reduce((sum, row) => sum + row.escrowAct, 0);

  const load = useCallback(async () => {
    if (status !== "unlocked" || !aktAddress) {
      setStuck([]);
      setLeasedRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const got = await fetchApiJson<{
        ok: boolean;
        data?: { items?: StuckAkashDeployment[]; leased?: LeasedAkashDeployment[] };
        error?: string;
      }>(`/api/akash/stuck-deployments?address=${encodeURIComponent(aktAddress)}`);
      if (!got.ok) {
        throw new Error(got.error);
      }
      const body = got.body;
      if (!body.ok) {
        throw new Error(body.error ?? "Could not load open orders.");
      }
      setStuck(Array.isArray(body.data?.items) ? body.data.items : []);
      setLeasedRaw(Array.isArray(body.data?.leased) ? body.data.leased : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load open orders.");
      setStuck([]);
      setLeasedRaw([]);
    } finally {
      setLoading(false);
    }
  }, [aktAddress, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCloseOne(dseq: number) {
    if (!identity?.mnemonic) return;
    setClosingDseq(dseq);
    setError("");
    setInfo("");
    try {
      const txHash = await closeStuckAkashDeployment({ mnemonic: identity.mnemonic, dseq });
      if (txHash) setLastTxHash(txHash);
      setInfo(`Deployment ${dseq} closed — ACT escrow returns to your wallet shortly.`);
      await load();
      void refreshBalances();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Close failed.";
      setError(
        /atob/i.test(raw)
          ? "Could not sign close transaction in the browser. Try another browser, or refresh and unlock your wallet again."
          : raw,
      );
    } finally {
      setClosingDseq(null);
    }
  }

  async function handleCloseAll() {
    if (!identity?.mnemonic) return;
    setClosing(true);
    setError("");
    setInfo("");
    try {
      const n = await closeOpenAkashDeployments({
        mnemonic: identity.mnemonic,
        onProgress: (m) => setInfo(m),
      });
      setInfo(
        n > 0
          ? `Closed ${n} order(s). Refresh balance — your ACT should increase.`
          : "No stuck orders to close.",
      );
      await load();
      void refreshBalances();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Could not close orders.";
      setError(
        /atob/i.test(raw)
          ? "Could not sign close transaction in the browser. Try another browser, or refresh and unlock your wallet again."
          : raw,
      );
      setInfo("");
    } finally {
      setClosing(false);
    }
  }

  const walletReady = status === "unlocked" && Boolean(identity?.mnemonic);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent">GPU wallet</p>
          <h1 className="text-xl font-bold text-text-primary">Stuck orders</h1>
          <p className="mt-1 max-w-xl text-sm text-text-secondary">
            Close open or leased deployments here to return escrowed ACT to your wallet, then
            rent again from marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/app/marketplace">Marketplace</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/app/gpu/jobs">GPU jobs</Link>
          </Button>
        </div>
      </div>

      {!walletReady ? (
        <Card>
          <CardContent className="p-6 text-sm text-amber-900">
            Unlock your NodeShare wallet to view and close stuck Akash orders.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-sky-200/90 bg-gradient-to-br from-sky-50/95 to-white">
            <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Your address
                </p>
                <p className="mt-1 break-all font-mono text-xs">{aktAddress}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Wallet balance
                </p>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {aktFormatted ?? formatAktDisplay(aktBalance ?? 0)}
                </p>
                <p className="font-mono text-xs text-text-secondary">
                  {actFormatted ?? formatActDisplay(actBalance ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Locked in stuck orders
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-amber-900">
                  {formatActDisplay(totalEscrowAct)}
                </p>
                <p className="text-xs text-text-muted">
                  {stuck.length} awaiting bid · {leased.length} need recovery
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 text-xs"
              disabled={loading || closing}
              onClick={() => void load()}
            >
              {loading ? "Refreshing…" : "Refresh list"}
            </Button>
            <Button
              type="button"
              className="h-9 text-xs"
              disabled={loading || closing || stuck.length + leased.length === 0}
              onClick={() => void handleCloseAll()}
            >
              {closing ? "Closing all…" : `Release all (${stuck.length + leased.length})`}
            </Button>
          </div>

          {info ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {info}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </p>
          ) : null}
          {lastTxHash ? (
            <p className="text-xs text-text-secondary">
              Last tx:{" "}
              <a
                href={akashTxExplorerUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-accent underline"
              >
                {lastTxHash.slice(0, 14)}…
              </a>
            </p>
          ) : null}

          {loading ? (
            <Card>
              <CardContent className="p-6 text-sm text-text-muted">Loading open orders…</CardContent>
            </Card>
          ) : leasedRaw.length > 0 && leased.length === 0 && stuck.length === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="space-y-3 p-6 text-sm text-emerald-950">
                <p className="font-semibold">Active GPU rental</p>
                <p>
                  Escrow is locked while your lease runs — that is normal. This page is only for
                  failed manifests or orders stuck without a bid.
                </p>
                <Button asChild>
                  <Link href="/app/gpu/jobs">Open GPU Jobs &amp; terminal</Link>
                </Button>
              </CardContent>
            </Card>
          ) : stuck.length === 0 && leased.length === 0 ? (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="space-y-3 p-6 text-sm text-emerald-950">
                <p className="font-semibold">No stuck orders</p>
                <p>Nothing is locking your ACT. You can rent a GPU from the marketplace.</p>
                <Button asChild>
                  <Link href="/app/marketplace">Browse GPUs</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {leased.length > 0 ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">
                  Manifest failed — close to recover ACT
                </p>
              ) : null}
              {leased.map((row) => (
                <Card key={`lease-${row.dseq}`} className="border-rose-200/80">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">
                        {row.gpuLabel} · dseq {row.dseq}
                      </p>
                      <p className="mt-1 text-sm text-rose-900">
                        Escrow locked:{" "}
                        <span className="font-mono font-semibold">{formatActDisplay(row.escrowAct)}</span>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Manifest did not complete for {shortAkash(row.provider)} — close to refund
                        escrowed ACT. If your GPU is running, use{" "}
                        <Link href="/app/gpu/jobs" className="font-medium text-accent underline">
                          GPU Jobs → Terminal
                        </Link>
                        , not this page.
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="h-9 shrink-0 px-4 text-xs"
                      disabled={closing || closingDseq != null}
                      onClick={() => void handleCloseOne(row.dseq)}
                    >
                      {closingDseq === row.dseq ? "Closing…" : "Close & recover ACT"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {stuck.length > 0 ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  No lease yet
                </p>
              ) : null}
              {stuck.map((row) => (
                <Card key={row.dseq} className="border-amber-200/80">
                  <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">
                        {row.gpuLabel} · dseq {row.dseq}
                      </p>
                      <p className="mt-1 text-sm text-amber-900">
                        Escrow locked: <span className="font-mono font-semibold">{formatActDisplay(row.escrowAct)}</span>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        No provider lease — order never finished. Close to refund ACT to your wallet.
                      </p>
                      {row.legacyMisusedSignedBy?.length ? (
                        <p className="mt-1 text-[11px] font-medium text-rose-800">
                          Old order used invalid provider lock ({shortAkash(row.legacyMisusedSignedBy[0])})
                          — providers could not bid. Close and rent again (fixed in latest app).
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-text-secondary">
                          Open market — any matching GPU provider can bid.
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="h-9 shrink-0 px-4 text-xs"
                      disabled={closing || closingDseq != null}
                      onClick={() => void handleCloseOne(row.dseq)}
                    >
                      {closingDseq === row.dseq ? "Closing…" : "Release ACT"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
