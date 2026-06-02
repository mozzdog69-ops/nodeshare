"use client";

import { mergeChainJobsWithLocal } from "@/lib/akash/fetch-akash-rental-jobs";
import { useWalletSession } from "@/context/wallet-session";
import { fetchGpuJobs } from "@/lib/gpu/gpu-power-service";
import { signingWalletFromIdentity } from "@/lib/gpu/gpu-wallet";
import {
  mergeGpuJobs,
  readGlobalGpuJobs,
  readLocalGpuJobs,
  saveLocalGpuJobs,
} from "@/lib/gpu/job-storage";
import type { GpuJob } from "@/lib/gpu/types";
import { apiUrl } from "@/lib/api-base";
import { useCallback, useEffect, useState } from "react";

export function useGpuRentalJobs() {
  const { identity, ethAddress, aktAddress } = useWalletSession();
  const [jobs, setJobs] = useState<GpuJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadLocal = useCallback(() => {
    const localEth = ethAddress ? (readLocalGpuJobs(ethAddress) as GpuJob[]) : [];
    const localAkt = aktAddress ? (readLocalGpuJobs(aktAddress) as GpuJob[]) : [];
    const globalJobs = readGlobalGpuJobs() as GpuJob[];
    return mergeGpuJobs(
      [],
      mergeGpuJobs(localEth, mergeGpuJobs(localAkt, globalJobs)),
    ) as GpuJob[];
  }, [ethAddress, aktAddress]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const bootstrap = reloadLocal();
    if (bootstrap.length > 0) setJobs(bootstrap);

    let chainJobs: GpuJob[] = [];
    if (aktAddress) {
      try {
        const res = await fetch(
          apiUrl(`/api/akash/rental-jobs?owner=${encodeURIComponent(aktAddress)}`),
          { cache: "no-store" },
        );
        const json = (await res.json()) as { ok?: boolean; items?: GpuJob[] };
        if (json.ok && Array.isArray(json.items)) chainJobs = json.items;
      } catch {
        /* LCD optional */
      }
    }

    let merged = (
      chainJobs.length > 0
        ? mergeChainJobsWithLocal(chainJobs, bootstrap)
        : bootstrap
    ) as GpuJob[];

    if (identity && ethAddress) {
      try {
        const wallet = signingWalletFromIdentity(identity);
        const data = await fetchGpuJobs({ wallet });
        merged = mergeChainJobsWithLocal(
          chainJobs,
          mergeGpuJobs(Array.isArray(data?.items) ? data.items : [], merged) as GpuJob[],
        ) as GpuJob[];
      } catch (e) {
        if (merged.length === 0) {
          setError(e instanceof Error ? e.message : "Could not load GPU jobs.");
        }
      }
    }

    if (aktAddress) saveLocalGpuJobs(aktAddress, merged);
    if (ethAddress) saveLocalGpuJobs(ethAddress, merged);
    setJobs(merged);
    setLoading(false);
  }, [aktAddress, ethAddress, identity, reloadLocal]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { jobs, loading, error, refresh, aktAddress, ethAddress };
}
