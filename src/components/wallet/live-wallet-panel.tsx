"use client";

import { apiUrl } from "@/lib/api-base";
import { useWalletSession } from "@/context/wallet-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SendStablecoinForm } from "@/components/wallet/send-stablecoin-form";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type BalancesPayload = {
  chainId: number;
  native: { symbol: string; balance: string };
  usdc: { contract: string; balance: string };
  usdt: { contract: string; balance: string };
};

type TransferRow = {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  symbol: string;
  value: string;
  decimals: number;
};

function fmtAddr(a: string) {
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

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

export function LiveWalletPanel() {
  const { ethAddress, identity } = useWalletSession();
  const [balances, setBalances] = useState<BalancesPayload | null>(null);
  const [balErr, setBalErr] = useState<string | null>(null);
  const [txs, setTxs] = useState<TransferRow[]>([]);
  const [txErr, setTxErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!ethAddress) return;
    setBalErr(null);
    setTxErr(null);
    const [bRes, tRes] = await Promise.all([
      fetch(
        apiUrl(
          `/api/chain/balances?address=${encodeURIComponent(ethAddress)}`,
        ),
      ),
      fetch(
        apiUrl(
          `/api/chain/transactions?address=${encodeURIComponent(ethAddress)}`,
        ),
      ),
    ]);
    const bJson = (await bRes.json()) as {
      ok: boolean;
      data?: BalancesPayload;
      error?: string;
    };
    if (bJson.ok && bJson.data) setBalances(bJson.data);
    else setBalErr(bJson.error ?? "Could not load balances");

    const tJson = (await tRes.json()) as {
      ok: boolean;
      data?: { transfers: TransferRow[] };
      error?: string;
    };
    if (tJson.ok && tJson.data?.transfers) setTxs(tJson.data.transfers);
    else {
      setTxs([]);
      setTxErr(tJson.error ?? null);
    }
  }, [ethAddress]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    const id = window.setInterval(() => void load(), 45_000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [load]);

  async function copyAddr() {
    if (!ethAddress) return;
    await navigator.clipboard.writeText(ethAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!ethAddress) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Live balances (Ethereum)
          </h2>
          <p className="text-sm text-text-secondary">
            Server reads via <code className="font-mono text-xs">ETH_RPC_URL</code>.
            Chain ID {balances?.chainId ?? "—"} · USDC + USDT (6 decimals).
          </p>
        </CardHeader>
        <CardContent>
          {balErr ? (
            <p className="text-sm text-amber-800">{balErr}</p>
          ) : balances ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
                <dt className="text-xs text-text-muted">ETH (gas)</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums">
                  {Number(balances.native.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </dd>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
                <dt className="text-xs text-text-muted">USDC</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-accent">
                  {Number(balances.usdc.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-base px-3 py-2">
                <dt className="text-xs text-text-muted">USDT</dt>
                <dd className="font-mono text-lg font-semibold tabular-nums text-accent">
                  {Number(balances.usdt.balance).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-text-muted">Loading balances…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Deposit & receive
          </h2>
          <p className="text-sm text-text-secondary">
            Send USDC or USDT on the same chain as your RPC (default Ethereum mainnet).
            Only this address — wrong network loses funds.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex-1 space-y-2">
              <p className="font-mono text-sm break-all text-text-primary">{ethAddress}</p>
              <Button variant="secondary" type="button" onClick={() => void copyAddr()}>
                {copied ? "Copied" : "Copy address"}
              </Button>
            </div>
            <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-border-subtle bg-white p-2">
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(ethAddress)}`}
                width={160}
                height={160}
                alt="Deposit address QR"
                unoptimized
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {identity?.mnemonic && balances ? (
        <SendStablecoinForm
          mnemonic={identity.mnemonic}
          usdcAddress={balances.usdc.contract}
          usdtAddress={balances.usdt.contract}
          onSent={() => void load()}
        />
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">
            Live transactions (USDC / USDT)
          </h2>
          <Button variant="ghost" className="text-xs" type="button" onClick={() => void load()}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {txErr ? (
            <p className="px-5 py-4 text-sm text-amber-800">{txErr}</p>
          ) : txs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-text-muted">No recent stablecoin transfers.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {txs.map((t) => {
                const inflow = t.to.toLowerCase() === ethAddress.toLowerCase();
                const amt = Number(t.value) / 10 ** t.decimals;
                return (
                  <li key={t.hash} className="px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-text-primary">
                        {t.symbol} · {inflow ? "Receive" : "Send"}
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          inflow ? "text-success" : "text-text-primary"
                        }`}
                      >
                        {inflow ? "+" : "−"}
                        {amt.toLocaleString(undefined, { maximumFractionDigits: 6 })}
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
                        {t.hash.slice(0, 10)}…
                      </a>
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {inflow ? "From" : "To"} {fmtAddr(inflow ? t.from : t.to)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
