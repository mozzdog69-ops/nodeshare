"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { formatAktDisplay } from "@/lib/gpu/quote-utils";
import { useLiveAktBalance } from "@/hooks/use-live-akt-balance";
import { useCallback, useEffect, useState } from "react";
import { StatRow } from "@/components/dashboard/stat-row";

export function DashboardLiveStats() {
  const { aktBalance, aktFormatted, loading: aktLoading, walletReady } = useLiveAktBalance();
  const [gpuBids, setGpuBids] = useState<number | null>(null);
  const [providersWithGpu, setProvidersWithGpu] = useState<number | null>(null);
  const [meshHint, setMeshHint] = useState("");

  const load = useCallback(async () => {
    const mGot = await fetchApiJson<{
      ok: boolean;
      data?: {
        orders?: unknown[];
        providersByOwner?: Record<string, unknown>;
      };
      error?: string;
    }>("/api/akash/market?limit=40");

    if (!mGot.ok) {
      setGpuBids(0);
      setProvidersWithGpu(0);
      setMeshHint(mGot.error);
      return;
    }

    const mj = mGot.body;
    if (!mj.ok) {
      setGpuBids(0);
      setProvidersWithGpu(0);
      setMeshHint(mj.error ?? "Akash market request failed");
      return;
    }

    const orders = mj.data?.orders ?? [];
    const providers = mj.data?.providersByOwner ?? {};
    const gpuCount = orders.length;
    setGpuBids(gpuCount);
    setProvidersWithGpu(Object.keys(providers).length);
    setMeshHint(
      gpuCount > 0
        ? `${gpuCount} open bids · ${Object.keys(providers).length} hosts with known GPU models`
        : "Quiet market snapshot",
    );
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const stats = [
    {
      label: "Your AKT (NodeShare wallet)",
      value:
        !walletReady ? "—" : aktLoading ? "…" : aktFormatted ?? formatAktDisplay(aktBalance ?? 0),
      hint: walletReady ? "Live Akash LCD · used for GPU checkout" : "Unlock wallet",
    },
    {
      label: "Open Akash GPU bids",
      value: gpuBids === null ? "…" : String(gpuBids),
      hint: "LCD market · models from Console API",
    },
    {
      label: "Providers with GPU inventory",
      value: providersWithGpu === null ? "…" : String(providersWithGpu),
      hint: meshHint,
    },
  ];

  return <StatRow stats={stats} />;
}
