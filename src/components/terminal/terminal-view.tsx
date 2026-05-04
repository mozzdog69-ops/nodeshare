"use client";

import { apiUrl } from "@/lib/api-base";
import { useWalletSession } from "@/context/wallet-session";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LiveJobPanel } from "@/components/terminal/live-job-panel";
import { NodeTerminal } from "@/components/terminal/node-terminal";

/** Minimum ETH for gas + optional stablecoin — tune as needed. */
const MIN_ETH = 0.000015;
const MIN_STABLE = 0.25;

export function TerminalView() {
  const { ethAddress } = useWalletSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [detail, setDetail] = useState<string>("");

  const check = useCallback(async () => {
    if (!ethAddress) {
      setAllowed(false);
      setDetail("Unlock your wallet to use the terminal.");
      return;
    }
    const res = await fetch(
      apiUrl(`/api/chain/balances?address=${encodeURIComponent(ethAddress)}`),
    );
    const j = (await res.json()) as {
      ok: boolean;
      error?: string;
      data?: {
        native: { balance: string };
        usdc: { balance: string };
        usdt: { balance: string };
      };
    };
    if (!j.ok || !j.data) {
      setAllowed(false);
      setDetail(j.error ?? "Could not read balances");
      return;
    }
    const eth = Number(j.data.native.balance);
    const usdc = Number(j.data.usdc.balance);
    const usdt = Number(j.data.usdt.balance);
    const stable = usdc + usdt;
    const ok = Number.isFinite(eth) && (eth >= MIN_ETH || stable >= MIN_STABLE);
    setAllowed(ok);
    setDetail(
      ok
        ? ""
        : `Fund gas (≥ ${MIN_ETH} ETH) or stablecoins (≥ $${MIN_STABLE} USDC+USDT combined) to unlock compute.`,
    );
  }, [ethAddress]);

  useEffect(() => {
    void check();
  }, [check]);

  if (!ethAddress) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="max-w-md text-sm text-text-secondary">
          Sign in with your recovery phrase to open the terminal session.
        </p>
        <Button asChild>
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 border border-dashed border-border-subtle bg-surface-elevated/60 p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">
          Live funding gate
        </p>
        <p className="max-w-lg text-sm text-text-secondary">{detail}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/app/wallet">Open wallet</Link>
          </Button>
          <Button variant="secondary" type="button" onClick={() => void check()}>
            Recheck balances
          </Button>
        </div>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Verifying on-chain balances…
      </div>
    );
  }

  return (
    <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_340px] lg:p-6">
      <NodeTerminal />
      <LiveJobPanel />
    </div>
  );
}
