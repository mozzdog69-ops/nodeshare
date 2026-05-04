"use client";

import { apiUrl } from "@/lib/api-base";
import { useWalletSession } from "@/context/wallet-session";
import { useCallback, useEffect, useState } from "react";
import { StatRow } from "@/components/dashboard/stat-row";

export function DashboardLiveStats() {
  const { ethAddress } = useWalletSession();
  const [orders, setOrders] = useState<number | null>(null);
  const [stableUsd, setStableUsd] = useState<string | null>(null);
  const [meshHint, setMeshHint] = useState<string>("");

  const load = useCallback(async () => {
    const [mRes, balRes] = await Promise.all([
      fetch(apiUrl("/api/akash/market?limit=40")),
      ethAddress
        ? fetch(apiUrl(`/api/chain/balances?address=${encodeURIComponent(ethAddress)}`))
        : Promise.resolve(null as Response | null),
    ]);

    const mj = (await mRes.json()) as {
      ok: boolean;
      data?: { orders?: unknown[] };
      error?: string;
    };
    const count = mj.ok && mj.data?.orders ? mj.data.orders.length : 0;
    setOrders(mj.ok ? count : 0);
    setMeshHint(
      mj.ok
        ? `Open orders (state=open) · LCD page limit`
        : (mj.error ?? "Akash market request failed"),
    );

    if (balRes) {
      const bj = (await balRes.json()) as {
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
