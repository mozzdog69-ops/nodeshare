"use client";

import { fetchAkashGpuOffers } from "@/lib/gpu/gpu-power-service";
import type { GpuOffer } from "@/lib/gpu/types";
import { useCallback, useEffect, useState } from "react";

type Options = {
  /** When false, skip GPU backend catalog fetch (LCD-only marketplace). */
  enabled?: boolean;
};

export function useAkashGpuCatalog(options?: Options) {
  const enabled = options?.enabled !== false;
  const [offers, setOffers] = useState<GpuOffer[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAkashGpuOffers();
      setOffers(rows);
    } catch (e) {
      setOffers([]);
      setError(e instanceof Error ? e.message : "GPU catalog unavailable");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setOffers([]);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [load, enabled]);

  return { offers, loading, error, reload: load };
}
