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

type LeaseRow = {
  key: string;
  dseq: string;
  state: string;
  provider: string;
  priceLine: string;
  createdRef: string;
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

function formatLeaseEntry(entry: unknown, index: number): LeaseRow | null {
  if (!entry || typeof entry !== "object") return null;
  const wrap = entry as Record<string, unknown>;
  const lease = wrap.lease;
  if (!lease || typeof lease !== "object") return null;
  const L = lease as Record<string, unknown>;
  const id = L.id;
  if (!id || typeof id !== "object") return null;
  const I = id as Record<string, unknown>;
  const dseq = String(I.dseq ?? "");
  const prov = String(I.provider ?? "");
  const provider =
    prov.length > 42 ? `${prov.slice(0, 20)}…${prov.slice(-6)}` : prov;
  const state = String(L.state ?? "");
  let priceLine = "—";
  const price = L.price;
  if (price && typeof price === "object") {
    const p = price as { amount?: string; denom?: string };
    const amt = Number(p.amount);
    const d = (p.denom ?? "").toLowerCase();
    if (d.includes("uakt") || d.endsWith("akt")) {
      if (Number.isFinite(amt))
        priceLine = `${(amt / 1_000_000).toFixed(4)} AKT / block (rate)`;
    } else if (Number.isFinite(amt) && p.denom) {
      priceLine = `${p.amount} ${p.denom.slice(0, 18)}`;
    }
  }
  const createdRef = String(L.created_at ?? "");
  return {
    key: `lease-${dseq}-${index}`,
    dseq,
    state,
    provider,
    priceLine,
    createdRef: createdRef ? `Block ${createdRef}` : "",
  };
}

export function LiveJobHistory() {
  const { ethAddress, aktAddress } = useWalletSession();
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [ethErr, setEthErr] = useState<string | null>(null);
  const [akashErr, setAkashErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setEthErr(null);
    setAkashErr(null);

    const ethP =
      ethAddress &&
      fetch(
        apiUrl(`/api/chain/transactions?address=${encodeURIComponent(ethAddress)}`),
      );

    const aktP =
      aktAddress &&
      fetch(
        apiUrl(`/api/akash/leases?address=${encodeURIComponent(aktAddress)}&limit=25`),
      );

    try {
      if (ethP) {
        const res = await ethP;
        const j = (await res.json()) as {
          ok: boolean;
          data?: { transfers?: TransferRow[] };
          error?: string;
        };
        if (j.ok && j.data?.transfers) setTransfers(j.data.transfers);
        else {
          setTransfers([]);
          setEthErr(j.error ?? "Could not load Ethereum transfers");
        }
      } else {
        setTransfers([]);
      }

      if (aktP) {
        const res = await aktP;
        const j = (await res.json()) as {
          ok: boolean;
          data?: { leases?: unknown[] };
          error?: string;
        };
        if (j.ok) {
          const raw = j.data?.leases;
          const rows = Array.isArray(raw)
            ? raw
                .map((e, i) => formatLeaseEntry(e, i))
                .filter((x): x is LeaseRow => x !== null)
            : [];
          setLeases(rows);
        } else {
          setLeases([]);
          setAkashErr(j.error ?? "Could not load Akash leases");
        }
      } else {
        setLeases([]);
      }
    } finally {
      setLoading(false);
    }
  }, [ethAddress, aktAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const noWallet = !ethAddress && !aktAddress;

  if (noWallet) {
    return (
      <p className="text-sm text-text-muted">
        Unlock your wallet to load Akash lease history (your akash1 address) and Ethereum
        stablecoin transfers (your 0x address).
      </p>
    );
  }

  const emptyAkash = aktAddress && leases.length === 0 && !akashErr && !loading;
  const emptyEth = ethAddress && transfers.length === 0 && !ethErr && !loading;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-text-secondary">
          <strong className="font-medium text-text-primary">Akash leases</strong> come from
          the public LCD (<code className="font-mono text-xs">/market/v1beta5/leases/list</code>
          ). <strong className="font-medium text-text-primary">USDC/USDT</strong> rows are from
          Etherscan for your ETH address.
        </p>
        <Button variant="ghost" className="text-xs shrink-0" type="button" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : null}

      {aktAddress ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Akash leases (LCD)
          </h2>
          {akashErr ? (
            <p className="mt-2 text-sm text-amber-800">{akashErr}</p>
          ) : null}
          {emptyAkash ? (
            <p className="mt-2 text-sm text-text-muted">No leases returned for your address.</p>
          ) : null}
          <div className="mt-4 space-y-3">
            {leases.map((l) => (
              <Card key={l.key} interactive>
                <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-text-primary">
                        Deployment {l.dseq}
                      </span>
                      <span className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-medium text-accent">
                        {l.state}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-text-muted">{l.provider}</p>
                    {l.createdRef ? (
                      <p className="mt-1 text-xs text-text-muted">{l.createdRef}</p>
                    ) : null}
                  </div>
                  <div className="font-mono text-sm font-semibold text-text-primary">
                    {l.priceLine}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {ethAddress ? (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Ethereum stablecoins (Etherscan)
          </h2>
          {ethErr ? <p className="mt-2 text-sm text-amber-800">{ethErr}</p> : null}
          {emptyEth ? (
            <p className="mt-2 text-sm text-text-muted">No recent USDC/USDT transfers.</p>
          ) : null}
          <div className="mt-4 space-y-4">
            {transfers.map((t) => {
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
        </section>
      ) : null}
    </div>
  );
}
