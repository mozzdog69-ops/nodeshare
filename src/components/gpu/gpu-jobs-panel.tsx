"use client";

import { AkashRentDebugPanel } from "@/components/gpu/akash-rent-debug-panel";
import { DirectAkashRentTracker } from "@/components/gpu/direct-akash-rent-tracker";
import { mergeChainJobsWithLocal } from "@/lib/akash/fetch-akash-rental-jobs";
import { isAkashLeaseTerminalReady } from "@/lib/akash/resolve-akash-gpu-job";
import { shouldShowAkashRentDebug } from "@/lib/akash/rent-debug";
import {
  isNonRetryableManifestError,
  ManifestUploadFailedError,
} from "@/lib/akash/send-manifest";
import { useWalletSession } from "@/context/wallet-session";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { isBidDeploymentMismatchMessage } from "@/lib/akash/fetch-lease-info";
import { resumeDirectAkashGpuRent, retryDirectAkashManifest } from "@/lib/akash/direct-rent";
import { closeStuckAkashDeployment } from "@/lib/akash/stuck-deployments";
import {
  isRentProgressInFlight,
  readDirectRentProgress,
  saveDirectRentProgress,
  clearDirectRentProgress,
} from "@/lib/akash/direct-rent-progress-storage";
import { createInitialRentProgress } from "@/lib/akash/direct-rent-steps";
import { fetchGpuJobs } from "@/lib/gpu/gpu-power-service";
import { signingWalletFromIdentity } from "@/lib/gpu/gpu-wallet";
import {
  mergeGpuJobs,
  readGlobalGpuJobs,
  readLocalGpuJobs,
  readRentManifestJsonForDseq,
  saveLocalGpuJobs,
  markAkashDseqJobs,
} from "@/lib/gpu/job-storage";
import type { GpuJob } from "@/lib/gpu/types";
import { apiUrl } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (["running", "delivered", "completed"].includes(s)) return "text-emerald-700";
  if (["failed", "cancelled", "bid_timeout"].includes(s)) return "text-rose-700";
  return "text-amber-800";
}

function isAwaitingBid(job: GpuJob) {
  return String(job.internal_status || "").toLowerCase() === "awaiting_bid";
}

function canOpenTerminal(job: GpuJob, leaseRetry?: LeaseRetryInfo) {
  const leaseState = String(leaseRetry?.leaseState ?? job.lease_state ?? "").toLowerCase();
  if (leaseState === "active") return true;
  if (leaseState && leaseState !== "active") return false;
  return isAkashLeaseTerminalReady(job);
}

function isExpiredJob(job: GpuJob, leaseRetry?: LeaseRetryInfo) {
  const leaseState = String(leaseRetry?.leaseState ?? job.lease_state ?? "").toLowerCase();
  if (leaseState && leaseState !== "active") return true;
  const s = String(job.internal_status || "").toLowerCase();
  return s === "expired" || s === "closed";
}

function normalizeManifestJob(job: GpuJob): GpuJob {
  const err = String(job.error_message || "").toLowerCase();
  let next = job;
  if (
    job.provider_status !== "manifest_failed" &&
    /failed to fetch|manifest upload|could not reach the gpu provider/.test(err)
  ) {
    next = { ...next, provider_status: "manifest_failed" };
  }
  if (/manifest hash did not match/i.test(String(next.error_message || ""))) {
    next = {
      ...next,
      internal_status: "lease_active",
      provider_status: "manifest_failed",
      error_message:
        "Manifest delivery failed; on-chain hash is correct. Tap Retry manifest (do not release ACT).",
    };
  }
  return next;
}

type LeaseRetryInfo = {
  canRetryManifest: boolean;
  retryBlockedReason?: string;
  leaseState?: string;
};

async function fetchLeaseRetryInfo(
  owner: string,
  dseq: number,
): Promise<LeaseRetryInfo | null> {
  try {
    const res = await fetch(
      apiUrl(
        `/api/akash/lease-info?owner=${encodeURIComponent(owner)}&dseq=${encodeURIComponent(String(dseq))}`,
      ),
      { cache: "no-store" },
    );
    const json = (await res.json()) as {
      ok?: boolean;
      canRetryManifest?: boolean;
      retryBlockedReason?: string | null;
      lease?: { state?: string };
    };
    if (!res.ok || !json.ok) return null;
    return {
      canRetryManifest: Boolean(json.canRetryManifest),
      retryBlockedReason: json.retryBlockedReason || undefined,
      leaseState: json.lease?.state,
    };
  } catch {
    return null;
  }
}

function rentSdlFromJob(job: GpuJob) {
  const hours = job.rent_sdl?.hours ?? 1;
  const deposit = Number(job.deposit_akt ?? 0.5);
  const base =
    job.rent_sdl?.hourlyAkt && job.rent_sdl.hours
      ? job.rent_sdl
      : {
          hourlyAkt: deposit / hours,
          hours,
          gpuLabel: job.gpu_model,
          openToAnyProvider: true,
        };
  return {
    ...base,
    manifestJson: job.rent_sdl?.manifestJson ?? base.manifestJson,
    anyNvidiaGpu: job.rent_sdl?.anyNvidiaGpu ?? base.anyNvidiaGpu,
    gpuModelSlug: job.rent_sdl?.gpuModelSlug ?? base.gpuModelSlug,
  };
}

export function GpuJobsPanel() {
  const router = useRouter();
  const { identity, ethAddress, aktAddress } = useWalletSession();
  const [jobs, setJobs] = useState<GpuJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumingDseq, setResumingDseq] = useState<number | null>(null);
  const [retryingManifestDseq, setRetryingManifestDseq] = useState<number | null>(null);
  const [closingDseq, setClosingDseq] = useState<number | null>(null);
  const [leaseRetryByDseq, setLeaseRetryByDseq] = useState<Record<number, LeaseRetryInfo>>({});
  const [rentProgress, setRentProgress] = useState(
    () => (aktAddress ? readDirectRentProgress(aktAddress) : null),
  );
  const [debugUploadKey, setDebugUploadKey] = useState(0);

  const walletReady = Boolean(identity?.mnemonic && aktAddress);

  const reloadJobs = useCallback(() => {
    const localEth = ethAddress ? (readLocalGpuJobs(ethAddress) as GpuJob[]) : [];
    const localAkt = aktAddress ? (readLocalGpuJobs(aktAddress) as GpuJob[]) : [];
    const globalJobs = readGlobalGpuJobs() as GpuJob[];
    const merged = mergeGpuJobs(
      [],
      mergeGpuJobs(localEth, mergeGpuJobs(localAkt, globalJobs)),
    ) as GpuJob[];
    return merged.map(normalizeManifestJob);
  }, [ethAddress, aktAddress]);

  useEffect(() => {
    if (!aktAddress) {
      setRentProgress(null);
      return;
    }
    const saved = readDirectRentProgress(aktAddress);
    if (saved?.failedStep === "manifest" || isRentProgressInFlight(saved)) {
      setRentProgress(saved);
      return;
    }
    setRentProgress(null);
  }, [aktAddress]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const bootstrap = reloadJobs();
      if (!dead && bootstrap.length > 0) setJobs(bootstrap);

      let chainJobs: GpuJob[] = [];
      if (aktAddress) {
        try {
          const res = await fetch(
            apiUrl(`/api/akash/rental-jobs?owner=${encodeURIComponent(aktAddress)}`),
            { cache: "no-store" },
          );
          const json = (await res.json()) as { ok?: boolean; items?: GpuJob[] };
          if (json.ok && Array.isArray(json.items)) {
            chainJobs = json.items;
          }
        } catch {
          /* LCD sync optional */
        }
      }

      const afterChain =
        chainJobs.length > 0
          ? (mergeChainJobsWithLocal(chainJobs, bootstrap) as GpuJob[])
          : bootstrap;
      if (!dead && afterChain.length > 0) {
        setJobs(afterChain);
        if (aktAddress) saveLocalGpuJobs(aktAddress, afterChain);
        if (ethAddress) saveLocalGpuJobs(ethAddress, afterChain);
      }

      if (!identity || !ethAddress) {
        setLoading(false);
        return;
      }

      try {
        const wallet = signingWalletFromIdentity(identity);
        const data = await fetchGpuJobs({ wallet });
        const merged = mergeChainJobsWithLocal(
          chainJobs,
          mergeGpuJobs(Array.isArray(data?.items) ? data.items : [], afterChain) as GpuJob[],
        ) as GpuJob[];
        if (ethAddress) saveLocalGpuJobs(ethAddress, merged);
        if (aktAddress) saveLocalGpuJobs(aktAddress, merged);
        if (!dead) setJobs(merged);
      } catch (e) {
        if (!dead) {
          if (afterChain.length === 0) {
            setError(e instanceof Error ? e.message : "Could not load GPU jobs.");
          }
          if (afterChain.length > 0) setJobs(afterChain);
        }
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [identity, ethAddress, aktAddress, reloadJobs]);

  useEffect(() => {
    if (!aktAddress) return;
    const dseqs = new Set<number>();
    if (rentProgress?.failedStep === "manifest" && rentProgress.dseq != null) {
      dseqs.add(rentProgress.dseq);
    }
    for (const job of jobs) {
      if (job.dseq != null && isManifestFailed(job)) dseqs.add(job.dseq);
    }
    if (!dseqs.size) return;

    let dead = false;
    void (async () => {
      const entries = await Promise.all(
        [...dseqs].map(async (dseq) => {
          const info = await fetchLeaseRetryInfo(aktAddress, dseq);
          return [dseq, info] as const;
        }),
      );
      if (dead) return;
      setLeaseRetryByDseq((prev) => {
        const next = { ...prev };
        for (const [dseq, info] of entries) {
          if (info) next[dseq] = info;
        }
        return next;
      });
    })();
    return () => {
      dead = true;
    };
  }, [aktAddress, jobs, rentProgress?.dseq, rentProgress?.failedStep]);

  function isManifestFailed(job: GpuJob) {
    if (String(job.provider_status || "").toLowerCase() === "manifest_failed") return true;
    const err = String(job.error_message || "").toLowerCase();
    if (
      /failed to fetch|manifest upload|manifest failed|hash mismatch|manifest version validation|could not reach the gpu provider|browser blocked/.test(
        err,
      )
    ) {
      return true;
    }
    if (
      rentProgress?.failedStep === "manifest" &&
      rentProgress.dseq != null &&
      job.dseq === rentProgress.dseq
    ) {
      return true;
    }
    return false;
  }

  async function handleCloseDeployment(job: GpuJob) {
    if (!identity?.mnemonic || job.dseq == null) return;
    setClosingDseq(job.dseq);
    setError("");
    try {
      await closeStuckAkashDeployment({ mnemonic: identity.mnemonic, dseq: job.dseq });
      if (aktAddress) {
        clearDirectRentProgress(aktAddress);
        markAkashDseqJobs([ethAddress || "", aktAddress], job.dseq, {
          internal_status: "cancelled",
          provider_status: "closed",
          error_message: "Deployment closed — ACT returned to wallet.",
        });
      }
      setJobs(reloadJobs());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close deployment.");
    } finally {
      setClosingDseq(null);
    }
  }

  async function handleRetryManifest(job: GpuJob) {
    if (!identity?.mnemonic || job.dseq == null) return;
    const sdl = rentSdlFromJob(job);
    setRetryingManifestDseq(job.dseq);
    setError("");
    try {
      setRentProgress(createInitialRentProgress(`Sending manifest for dseq ${job.dseq}…`));
      const result = await retryDirectAkashManifest({
        mnemonic: identity.mnemonic,
        dseq: job.dseq,
        provider:
          sanitizeAkashAddress(job.provider_owner) ||
          sanitizeAkashAddress(job.provider_id) ||
          undefined,
        title: job.title,
        hourlyAkt: sdl.hourlyAkt,
        hours: sdl.hours,
        gpuLabel: sdl.gpuLabel,
        gpuModelSlug: sdl.gpuModelSlug,
        manifestJson:
          sdl.manifestJson ??
          (aktAddress ? readRentManifestJsonForDseq(aktAddress, job.dseq) : undefined),
        onProgress: (p) => {
          setRentProgress(p);
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
        },
      });
      if (aktAddress) clearDirectRentProgress(aktAddress);
      setJobs(reloadJobs());
      router.push(`/app/gpu/terminal/${encodeURIComponent(result.job.id)}`);
    } catch (e) {
      if (e instanceof ManifestUploadFailedError) {
        setDebugUploadKey((k) => k + 1);
      }
      setError(e instanceof Error ? e.message : "Manifest retry failed.");
    } finally {
      setRetryingManifestDseq(null);
    }
  }

  async function handleResume(job: GpuJob) {
    if (!identity?.mnemonic || job.dseq == null) return;
    const sdl = rentSdlFromJob(job);
    setResumingDseq(job.dseq);
    setError("");
    try {
      setRentProgress(createInitialRentProgress(`Resuming dseq ${job.dseq}…`));
      const result = await resumeDirectAkashGpuRent({
        mnemonic: identity.mnemonic,
        dseq: job.dseq,
        title: job.title,
        hourlyAkt: sdl.hourlyAkt,
        hours: sdl.hours,
        gpuLabel: sdl.gpuLabel,
        gpuModelSlug: sdl.gpuModelSlug,
        gpuVram: sdl.gpuVram,
        gpuInterface: sdl.gpuInterface,
        openToAnyProvider: sdl.openToAnyProvider !== false,
        providerOwner: sdl.providerOwner,
        manifestJson: sdl.manifestJson,
        onProgress: (p) => {
          setRentProgress(p);
          if (aktAddress) saveDirectRentProgress(aktAddress, p);
        },
      });
      if (aktAddress) clearDirectRentProgress(aktAddress);
      const merged = reloadJobs();
      setJobs(merged);
      router.push(`/app/gpu/terminal/${encodeURIComponent(result.job.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resume rent.");
      setRentProgress((p) => {
        if (p && aktAddress) saveDirectRentProgress(aktAddress, p);
        return p;
      });
      if (job.dseq != null && aktAddress) {
        markAkashDseqJobs([ethAddress || "", aktAddress], job.dseq, {
          internal_status: "failed",
          provider_status: "bid_timeout",
          error_message: e instanceof Error ? e.message : "Resume failed.",
        });
        setJobs(reloadJobs());
      }
    } finally {
      setResumingDseq(null);
    }
  }

  const failedProgress = rentProgress?.failedStep ? rentProgress : null;
  const showTracker =
    rentProgress && (isRentProgressInFlight(rentProgress) || Boolean(failedProgress));
  const progressManifestDseq =
    rentProgress?.failedStep === "manifest" ? rentProgress.dseq ?? null : null;
  const progressLeaseRetry =
    progressManifestDseq != null ? leaseRetryByDseq[progressManifestDseq] : undefined;
  const progressManifestError =
    rentProgress?.failedStep === "manifest"
      ? rentProgress.steps.manifest?.detail || rentProgress.message || ""
      : "";
  const progressNonRetryable =
    isNonRetryableManifestError(progressManifestError) ||
    isBidDeploymentMismatchMessage(progressManifestError);
  const progressCanRetryManifest =
    progressLeaseRetry?.canRetryManifest === true && !progressNonRetryable;
  const progressLeaseExpired =
    progressLeaseRetry?.canRetryManifest === false || progressNonRetryable;
  const progressBidMismatch =
    isBidDeploymentMismatchMessage(progressLeaseRetry?.retryBlockedReason || "") ||
    isBidDeploymentMismatchMessage(progressManifestError);

  const debugDseq = progressManifestDseq ?? jobs.find((j) => isManifestFailed(j))?.dseq ?? null;
  const debugJob = debugDseq != null ? jobs.find((j) => j.dseq === debugDseq) : undefined;
  const debugManifestJson =
    debugJob != null
      ? rentSdlFromJob(debugJob).manifestJson ??
        (aktAddress ? readRentManifestJsonForDseq(aktAddress, debugDseq!) : undefined)
      : aktAddress && debugDseq != null
        ? readRentManifestJsonForDseq(aktAddress, debugDseq)
        : undefined;

  const showManifestDebug =
    Boolean(aktAddress && debugDseq != null) &&
    (shouldShowAkashRentDebug(
      Boolean(
        rentProgress?.failedStep === "manifest" ||
          jobs.some((j) => j.dseq === debugDseq && isManifestFailed(j)),
      ),
    ) ||
      Boolean(error && /manifest|mtls|502/i.test(error)));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent">GPU Jobs</p>
          <h1 className="text-xl font-bold text-text-primary">Akash rentals</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/app/gpu/stuck-orders">Stuck orders</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/app/marketplace">Browse marketplace</Link>
          </Button>
        </div>
      </div>

      {rentProgress?.failedStep === "manifest" &&
      rentProgress.dseq != null &&
      walletReady ? (
        <Card
          className={
            progressCanRetryManifest
              ? "border-emerald-300 bg-emerald-50"
              : progressLeaseExpired
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-slate-50"
          }
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p
                className={`text-sm font-semibold ${
                  progressCanRetryManifest
                    ? "text-emerald-950"
                    : progressLeaseExpired
                      ? "text-amber-950"
                      : "text-text-primary"
                }`}
              >
                {progressCanRetryManifest
                  ? "Manifest upload failed"
                  : progressBidMismatch
                    ? "Provider bid mismatch — recover ACT"
                    : progressNonRetryable
                      ? "Provider rejected manifest — recover ACT"
                      : progressLeaseExpired
                        ? "Lease expired — recover ACT"
                        : "Checking lease status…"}
              </p>
              <p
                className={`mt-1 text-xs ${
                  progressCanRetryManifest
                    ? "text-emerald-900"
                    : progressLeaseExpired
                      ? "text-amber-900"
                      : "text-text-muted"
                }`}
              >
                {progressCanRetryManifest ? (
                  <>
                    Active lease for <span className="font-mono">dseq {rentProgress.dseq}</span>.
                    Tap Retry manifest — no new ACT escrow.
                  </>
                ) : progressNonRetryable ? (
                  <>
                    Manifest hash matches Akash, but this host rejected delivery.{" "}
                    <strong>Close &amp; recover ACT</strong> — do not retry (saves gas).
                  </>
                ) : progressLeaseExpired ? (
                  progressLeaseRetry?.retryBlockedReason ||
                  "This lease is no longer active. Close the deployment on Stuck orders to recover ACT, then rent again."
                ) : (
                  <>Looking up on-chain lease for dseq {rentProgress.dseq}…</>
                )}
              </p>
            </div>
            {progressCanRetryManifest ? (
              <Button
                type="button"
                className="h-9 shrink-0 border-emerald-700 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                disabled={retryingManifestDseq != null}
                onClick={() => {
                  const job =
                    jobs.find((j) => j.dseq === rentProgress.dseq) ?? ({
                      id: `akash-${rentProgress.dseq}-open`,
                      dseq: rentProgress.dseq,
                      title: `Akash dseq ${rentProgress.dseq}`,
                    } as GpuJob);
                  void handleRetryManifest(job);
                }}
              >
                {retryingManifestDseq != null ? "Sending…" : "Retry manifest"}
              </Button>
            ) : progressLeaseExpired ? (
              <Button
                type="button"
                variant="secondary"
                className="h-9 shrink-0 text-xs"
                disabled={closingDseq != null}
                onClick={() => {
                  const job =
                    jobs.find((j) => j.dseq === rentProgress.dseq) ?? ({
                      id: `akash-${rentProgress.dseq}-open`,
                      dseq: rentProgress.dseq,
                      title: `Akash dseq ${rentProgress.dseq}`,
                    } as GpuJob);
                  void handleCloseDeployment(job);
                }}
              >
                {closingDseq === rentProgress.dseq ? "Closing…" : "Close & recover ACT"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-text-muted">Loading jobs…</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="space-y-2 p-4 text-sm text-amber-900">
            <p className="whitespace-pre-wrap break-words">{error}</p>
            <Button variant="secondary" className="h-8 text-xs" asChild>
              <Link href="/app/gpu/stuck-orders">Open stuck orders</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showManifestDebug && aktAddress && debugDseq != null ? (
        <AkashRentDebugPanel
          key={`${debugDseq}-${debugUploadKey}`}
          owner={aktAddress}
          dseq={debugDseq}
          clientManifestJson={debugManifestJson}
          forceVisible
        />
      ) : null}

      {showTracker ? (
        <div className="space-y-2">
          <DirectAkashRentTracker progress={rentProgress} />
          {failedProgress &&
          failedProgress.failedStep !== "manifest" ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-wrap items-center gap-2 p-3 text-sm text-amber-950">
                <span>
                  Rent stopped at step {failedProgress.failedStep}. Close the deployment on{" "}
                  <strong>Stuck orders</strong> to recover ACT, then rent again.
                </span>
                <Button variant="secondary" className="h-8 text-xs" asChild>
                  <Link href="/app/gpu/stuck-orders">Stuck orders</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {!loading && jobs.length === 0 && !showTracker ? (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-text-secondary">
            <p>No GPU jobs yet.</p>
            <Button asChild>
              <Link href="/app/marketplace">Rent from live offers</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {jobs.length > 0 ? (
        <p className="text-xs text-text-muted">
          Active leases can open the GPU terminal. Ended leases stay listed for reference.
        </p>
      ) : null}

      <div className="space-y-6">
        {(["active", "expired"] as const).map((section) => {
          const sectionJobs = jobs.filter((job) => {
            const leaseRetry = job.dseq != null ? leaseRetryByDseq[job.dseq] : undefined;
            const expired = isExpiredJob(job, leaseRetry);
            return section === "expired" ? expired : !expired;
          });
          if (sectionJobs.length === 0) return null;
          return (
            <div key={section} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                {section === "active" ? "Active rentals" : "Ended / expired"}
              </h2>
              <div className="grid gap-3">
                {sectionJobs.map((job) => {
          const status = String(job.internal_status || "pending");
          const awaiting = isAwaitingBid(job);
          const manifestFailed = isManifestFailed(job);
          const leaseRetry = job.dseq != null ? leaseRetryByDseq[job.dseq] : undefined;
          const canRetryManifest =
            manifestFailed &&
            leaseRetry?.canRetryManifest === true &&
            !isNonRetryableManifestError(String(job.error_message || ""));
          const leaseExpired = manifestFailed && leaseRetry?.canRetryManifest === false;
          const failed =
            (["failed", "bid_timeout"].includes(status.toLowerCase()) && !manifestFailed) ||
            (status.toLowerCase() === "manifest_failed" && !canRetryManifest);
          return (
            <Card key={job.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-text-primary">{job.title || "GPU job"}</p>
                  <p className="font-mono text-xs text-text-muted">{job.id}</p>
                  <p className={`mt-1 text-xs font-semibold uppercase ${statusTone(status)}`}>{status}</p>
                  {job.error_message ? (
                    <p className="mt-1 text-xs text-rose-700">{job.error_message}</p>
                  ) : null}
                  {job.dseq != null ? (
                    <p className="mt-1 font-mono text-[11px] text-text-muted">dseq {job.dseq}</p>
                  ) : null}
                  {awaiting ? (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Deployment is open on-chain — providers often bid 30–90s after create.
                    </p>
                  ) : manifestFailed ? (
                    <p className="mt-1 text-[11px] text-emerald-900">
                      {isNonRetryableManifestError(String(job.error_message || "")) &&
                      !isBidDeploymentMismatchMessage(String(job.error_message || "")) ? (
                        <>
                          Hash is correct but this provider rejected the manifest —{" "}
                          <strong>Close &amp; recover ACT</strong>, then rent another GPU host.
                        </>
                      ) : /bid does not match|provider's bid|any nvidia.*locked to/i.test(
                    String(job.error_message || ""),
                  ) ? (
                        <>
                          Provider bid does not match this deployment —{" "}
                          <strong>Close &amp; recover ACT</strong>, then rent again from marketplace.
                        </>
                      ) : canRetryManifest ? (
                        <>
                          Manifest upload failed. Try <strong>Retry manifest</strong> once; if it
                          keeps failing, use <strong>Close &amp; recover ACT</strong>.
                        </>
                      ) : leaseExpired ? (
                        leaseRetry?.retryBlockedReason ||
                        "Lease is no longer active. Close the deployment on Stuck orders to recover ACT."
                      ) : (
                        "Checking on-chain lease status…"
                      )}
                    </p>
                  ) : failed ? (
                    <p className="mt-1 text-[11px] text-amber-800">
                      Bids may have arrived after the wait — try Complete rent before releasing
                      ACT.
                    </p>
                  ) : null}
                  {(awaiting || failed) && job.dseq != null ? (
                    <p className="mt-1 text-[11px] text-text-secondary">
                      Release ACT on Stuck orders only if you want to cancel this deployment.
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {manifestFailed && job.dseq != null && walletReady ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 text-xs"
                      disabled={
                        closingDseq != null ||
                        retryingManifestDseq != null ||
                        resumingDseq != null
                      }
                      onClick={() => void handleCloseDeployment(job)}
                    >
                      {closingDseq === job.dseq ? "Closing…" : "Close & recover ACT"}
                    </Button>
                  ) : null}
                  {canRetryManifest && job.dseq != null && walletReady ? (
                    <Button
                      type="button"
                      className="h-9 border-emerald-700 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      disabled={
                        retryingManifestDseq != null ||
                        resumingDseq != null ||
                        closingDseq != null
                      }
                      onClick={() => void handleRetryManifest(job)}
                    >
                      {retryingManifestDseq === job.dseq ? "Sending manifest…" : "Retry manifest"}
                    </Button>
                  ) : null}
                  {leaseExpired ? (
                    <Button variant="secondary" className="h-9 text-xs" asChild>
                      <Link href="/app/gpu/stuck-orders">Recover ACT</Link>
                    </Button>
                  ) : null}
                  {(awaiting || (failed && !manifestFailed)) && job.dseq != null && walletReady ? (
                    <>
                      <Button
                        type="button"
                        className="h-9 text-xs"
                        disabled={resumingDseq != null}
                        onClick={() => void handleResume(job)}
                      >
                        {resumingDseq === job.dseq
                          ? "Waiting for bids…"
                          : failed
                            ? "Complete rent (check bids)"
                            : "Wait for bids again"}
                      </Button>
                      <Button variant="secondary" className="h-9 text-xs" asChild>
                        <Link href="/app/gpu/stuck-orders">Release ACT</Link>
                      </Button>
                    </>
                  ) : null}
                  {canOpenTerminal(job, leaseRetry) ? (
                    <Button asChild className="h-9 text-xs">
                      <Link
                        href={`/app/terminal?job=${encodeURIComponent(job.id)}`}
                      >
                        Go to terminal
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
