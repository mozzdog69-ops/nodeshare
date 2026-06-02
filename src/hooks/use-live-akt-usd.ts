"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { getAktUsdEstimate } from "@/lib/akash/akt-price";
import { useCallback, useEffect, useState } from "react";

type AktPriceResponse = {
  ok: boolean;
  data?: { usd: number; source?: string };
};

/** Live AKT/USD for BME mint estimates (CoinGecko via /api/akash/akt-price). */
export function useLiveAktUsd(pollMs = 120_000) {
  const [aktUsd, setAktUsd] = useState(getAktUsdEstimate());
  const [source, setSource] = useState<string>("fallback");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const got = await fetchApiJson<AktPriceResponse>("/api/akash/akt-price");
      if (got.ok && got.body.ok && got.body.data?.usd && got.body.data.usd > 0) {
        setAktUsd(got.body.data.usd);
        setSource(got.body.data.source ?? "live");
      }
    } catch {
      setAktUsd(getAktUsdEstimate());
      setSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return undefined;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [pollMs, refresh]);

  return { aktUsd, source, loading, refresh };
}
