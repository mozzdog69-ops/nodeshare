"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { useCallback, useEffect, useState } from "react";

export function useGpuBackendStatus() {
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const got = await fetchApiJson<{ ok: boolean; configured?: boolean }>(
        "/api/marketplace/gpu/status",
      );
      setConfigured(Boolean(got.ok && got.body?.configured));
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { configured, loading, reload: load };
}
