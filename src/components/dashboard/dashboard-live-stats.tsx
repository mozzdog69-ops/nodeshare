"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { useWalletSession } from "@/context/wallet-session";
import { useCallback, useEffect, useState } from "react";
import { StatRow } from "@/components/dashboard/stat-row";

export function DashboardLiveStats() {
  const { ethAddress } = useWalletSession();
  const [orders, setOrders] = useState<number | null>(null);
  const [stableUsd, setStableUsd] = useState<string | null>(null);
  const [meshHint, setMeshHint] = useState<string>("");

  const load = useCallback(async () => {
    const [mGot, balGot] = await Promise.all([
      fetchApiJson<{
        ok: boolean;
        data?: { orders?: unknown[] };
        error?: string;
      }>("/api/akash/market?limit=40"),
      ethAddress
        ? fetchApiJson<{
            ok: boolean;
            data?: { usdc?: { balance?: string }; usdt?: { balance?: string } };
          }>(`/api/chain/balances?address=${encodeURIComponent(ethAddress)}`)
        : Promise.resolve(null as Awaited<ReturnType<typeof fetchApiJson>> | null),
    ]);

    if (!mGot.ok) {
      setOrders(0);
      setMeshHint(mGot.error);
    } else {
      const mj = mGot.body;
      const count = mj.ok && mj.data?.orders ? mj.data.orders.length : 0;
      setOrders(mj.ok ? count : 0);
      setMeshHint(
        mj.ok
          ? `Open orders (state=open) · LCD page limit`
          : (mj.error ?? "Akash market request failed"),
      );
    }

    if (balGot?.ok) {
      const bj = balGot.body as {
        ok: boolean;
        data?: { usdc?: { balance?: string }; usdt?: { balance?: string } };
      };
      if (bj.ok && bj.data) {
        const u = Number(bj.data.usdc?.balance ?? 0) + Number(bj.data.usdt?.balance ?? 0);
        setStableUsd(u.toLocaleString(undefined, { maximumFractionDigits: 2 }));
      }
    }
  }, [ethAddress]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const stats = [
    {
      label: "Open Akash bids",
      value: orders === null ? "…" : String(orders ?? 0),
      hint: "LCD market orders (current page)",
    },
    {
      label: "Stable liquidity (USDC+USDT)",
      value: stableUsd === null ? "—" : `$${stableUsd}`,
      hint: ethAddress ? "Your wallet on Ethereum" : "Unlock wallet",
    },
    {
      label: "Mesh snapshot",
      value: orders === null ? "…" : orders > 0 ? "Live" : "Quiet",
      hint: meshHint,
    },
  ];

  return <StatRow stats={stats} />;
}
