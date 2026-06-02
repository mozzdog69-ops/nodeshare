"use client";

import { GpuTerminalPanel } from "@/components/gpu/gpu-terminal-panel";
import { GpuSessionPicker, terminalReadyJobs } from "@/components/terminal/gpu-session-picker";
import { apiUrl } from "@/lib/api-base";
import { fetchApiJson } from "@/lib/fetch-api";
import { mergeChainJobsWithLocal } from "@/lib/akash/fetch-akash-rental-jobs";
import { listTerminalReadyJobs } from "@/lib/akash/resolve-akash-gpu-job";
import { useGpuRentalJobs } from "@/hooks/use-gpu-rental-jobs";
import type { GpuJob } from "@/lib/gpu/types";
import { useWalletSession } from "@/context/wallet-session";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const MIN_AKT = 0.01;

export function TerminalView() {
  const { aktAddress } = useWalletSession();
  const { jobs, loading: jobsLoading, error: jobsError, refresh } = useGpuRentalJobs();
  const [chainLeases, setChainLeases] = useState<GpuJob[]>([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [detail, setDetail] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadedJobId, setLoadedJobId] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!aktAddress) {
      setAllowed(false);
      setDetail("Unlock your wallet to use the terminal.");
      return;
    }
    const got = await fetchApiJson<{
      ok: boolean;
      error?: string;
      data?: { uakt: string; aktFormatted: string };
    }>(`/api/akash/bank?address=${encodeURIComponent(aktAddress)}`);
    if (!got.ok) {
      setAllowed(false);
      setDetail(got.error);
      return;
    }
    const j = got.body;
    if (!j.ok || !j.data) {
      setAllowed(false);
      setDetail(j.error ?? "Could not read AKT balance from Akash.");
      return;
    }
    const uakt = Number(j.data.uakt);
    const akt = Number.isFinite(uakt) ? uakt / 1_000_000 : NaN;
    const ok = Number.isFinite(akt) && akt >= MIN_AKT;
    setAllowed(ok);
    setDetail(
      ok
        ? ""
        : `Fund this Akash address with at least ${MIN_AKT} AKT (you have ${j.data.aktFormatted} AKT).`,
    );
  }, [aktAddress]);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (!aktAddress) {
      setChainLeases([]);
      setChainLoading(false);
      return;
    }
    let dead = false;
    setChainLoading(true);
    (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/akash/rental-jobs?owner=${encodeURIComponent(aktAddress)}`),
          { cache: "no-store" },
        );
        const json = (await res.json()) as { ok?: boolean; items?: GpuJob[] };
        if (!dead && json.ok && Array.isArray(json.items)) {
          setChainLeases(json.items);
        }
      } catch {
        if (!dead) setChainLeases([]);
      } finally {
        if (!dead) setChainLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [aktAddress]);

  const mergedForTerminal = mergeChainJobsWithLocal(
    chainLeases,
    jobs,
  ) as GpuJob[];
  const ready = listTerminalReadyJobs(
    mergedForTerminal.length > 0 ? mergedForTerminal : jobs,
  );
  const pickerLoading = jobsLoading || chainLoading;

  useEffect(() => {
    if (!selectedJobId && ready.length === 1) {
      setSelectedJobId(ready[0]!.id);
    }
  }, [ready, selectedJobId]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const fromUrl = params.get("job")?.trim();
    if (fromUrl && ready.some((j) => j.id === fromUrl)) {
      setSelectedJobId(fromUrl);
      setLoadedJobId(fromUrl);
    }
  }, [ready]);

  const handleLoadTerminal = () => {
    if (!selectedJobId) return;
    setLoadedJobId(selectedJobId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("job", selectedJobId);
      window.history.replaceState(null, "", url.toString());
    }
  };

  if (!aktAddress) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="max-w-md text-sm text-text-secondary">
          Sign in with your recovery phrase to open a GPU terminal session.
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
          AKT on Akash required
        </p>
        <p className="max-w-lg text-sm text-text-secondary">{detail}</p>
        <p className="max-w-md font-mono text-xs text-text-muted break-all">{aktAddress}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/app/wallet">Open wallet</Link>
          </Button>
          <Button variant="secondary" type="button" onClick={() => void check()}>
            Recheck AKT balance
          </Button>
        </div>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Checking AKT balance on Akash…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      {jobsError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm text-amber-900">
            <span>{jobsError}</span>
            <Button variant="secondary" className="h-8 text-xs" type="button" onClick={() => void refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(260px,320px)_1fr] lg:items-stretch">
        <GpuSessionPicker
          jobs={mergedForTerminal.length > 0 ? mergedForTerminal : jobs}
          loading={pickerLoading}
          selectedId={selectedJobId}
          onSelect={setSelectedJobId}
          onLoadTerminal={handleLoadTerminal}
          terminalActive={Boolean(loadedJobId)}
        />

        <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated">
          {loadedJobId ? (
            <GpuTerminalPanel key={loadedJobId} jobId={loadedJobId} embedded />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm font-medium text-text-primary">GPU SSH terminal</p>
              <p className="max-w-md text-sm text-text-secondary">
                Choose an active rental on the left, then click{" "}
                <span className="font-medium">Load terminal</span> to connect to your provider.
              </p>
              {ready.length > 0 ? (
                <Button
                  type="button"
                  className="h-9 text-xs"
                  disabled={!selectedJobId || pickerLoading}
                  onClick={handleLoadTerminal}
                >
                  Load terminal
                </Button>
              ) : pickerLoading ? (
                <p className="text-xs text-text-muted">Loading active leases from Akash…</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
