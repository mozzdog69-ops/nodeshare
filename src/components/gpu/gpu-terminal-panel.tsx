"use client";

import { useWalletSession } from "@/context/wallet-session";
import { readManifestCertificatePem } from "@/lib/akash/manifest-certificate-storage";
import { resolveAkashGpuJob, isAkashLeaseJobId } from "@/lib/akash/resolve-akash-gpu-job";
import { AkashLeaseShellTerminal } from "@/components/gpu/akash-lease-shell-terminal";
import { akashProviderProxyWsUrl } from "@/lib/akash/akash-provider-shell-client";
import {
  requestAkashTerminalSession,
  type AkashTerminalSessionResult,
} from "@/lib/gpu/akash-terminal";
import { requestGpuTerminalSession } from "@/lib/gpu/gpu-power-service";
import { markAkashDseqJobs, readGlobalGpuJobs, readLocalGpuJobs } from "@/lib/gpu/job-storage";
import { signingWalletFromIdentity } from "@/lib/gpu/gpu-wallet";
import type { GpuJob } from "@/lib/gpu/types";
import { apiUrl } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTO_OPEN = process.env.NEXT_PUBLIC_GPU_TERMINAL_AUTO_OPEN !== "0";

function sessionReady(session: AkashTerminalSessionResult | null): boolean {
  if (!session) return false;
  if (session.token && session.ws_path) return true;
  if (session.mode === "provider_shell" && session.shell_jwt && session.host_uri) return true;
  if (session.mode === "ssh" && session.ssh?.host) return true;
  return false;
}

export function GpuTerminalPanel({
  jobId,
  embedded = false,
}: {
  jobId: string;
  /** Hide page chrome when nested under /app/terminal */
  embedded?: boolean;
}) {
  const { identity, aktAddress, ethAddress } = useWalletSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobMeta, setJobMeta] = useState<GpuJob | null>(null);
  const [session, setSession] = useState<AkashTerminalSessionResult | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const isAkashJob = useMemo(() => isAkashLeaseJobId(jobId), [jobId]);

  const wsBase = useMemo(
    () => String(process.env.NEXT_PUBLIC_GPU_TERMINAL_WS_URL || "").trim().replace(/\/$/, ""),
    [],
  );

  const terminalUrl = useMemo(() => {
    if (!session?.token || !session?.ws_path) return "";
    if (wsBase) return `${wsBase}${session.ws_path}?token=${encodeURIComponent(session.token)}`;
    return `${session.ws_path}?token=${encodeURIComponent(session.token)}`;
  }, [session, wsBase]);

  const loadJobMeta = useCallback(async () => {
    if (!isAkashJob || !aktAddress) return null;
    const local = [
      ...(readLocalGpuJobs(aktAddress) as GpuJob[]),
      ...(ethAddress ? (readLocalGpuJobs(ethAddress) as GpuJob[]) : []),
      ...(readGlobalGpuJobs() as GpuJob[]),
    ];
    let chainJobs: GpuJob[] = [];
    try {
      const res = await fetch(
        apiUrl(`/api/akash/rental-jobs?owner=${encodeURIComponent(aktAddress)}`),
        { cache: "no-store" },
      );
      const json = (await res.json()) as { ok?: boolean; items?: GpuJob[] };
      if (json.ok && Array.isArray(json.items)) chainJobs = json.items;
    } catch {
      /* optional */
    }
    const resolved = await resolveAkashGpuJob({
      jobId,
      owner: aktAddress,
      localJobs: local,
      chainJobs,
    });
    if (resolved.job) setJobMeta(resolved.job);
    return resolved;
  }, [aktAddress, ethAddress, isAkashJob, jobId]);

  const openSession = useCallback(async () => {
    if (!identity) {
      setError("Unlock your wallet first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const wallet = signingWalletFromIdentity(identity);

      if (isAkashJob) {
        if (!aktAddress || !identity.mnemonic) {
          setError("Akash address and recovery phrase are required for GPU terminal.");
          return;
        }
        const resolved = await loadJobMeta();
        if (!resolved?.provider || !resolved.dseq) {
          setError(
            "Job not found. Open GPU Jobs — your rental may still be provisioning, or this lease has ended.",
          );
          return;
        }
        if (resolved.leaseState && resolved.leaseState !== "active") {
          setError("This GPU lease has ended. Rent again from the marketplace.");
          return;
        }
        const res = await requestAkashTerminalSession({
          wallet,
          mnemonic: identity.mnemonic,
          owner: aktAddress,
          jobId,
          dseq: resolved.dseq,
          provider: resolved.provider,
          gseq: resolved.job?.gseq,
          oseq: resolved.job?.oseq,
          clientCertificate: readManifestCertificatePem(aktAddress),
        });
        setSession(res);
        if (
          aktAddress &&
          resolved.dseq &&
          (res.mode === "ssh" || res.mode === "provider_shell")
        ) {
          markAkashDseqJobs(
            [aktAddress, ethAddress].filter(Boolean) as string[],
            resolved.dseq,
            {
              id: jobId,
              internal_status: "running",
              provider_status: "lease_active",
              lease_state: "active",
            },
          );
        }
        return;
      }

      const res = await requestGpuTerminalSession({ wallet, jobId });
      setSession({ mode: "iframe", ...res });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not open terminal session.";
      if (/still starting|waiting for provider|queued/i.test(msg)) {
        setError("Waiting for provider to start your GPU (SSH)…");
      } else if (/job not found/i.test(msg)) {
        setError(
          "Job not found in the provisioner. For direct Akash rent, use GPU Jobs after manifest delivery.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [identity, isAkashJob, aktAddress, jobId, loadJobMeta]);

  useEffect(() => {
    if (!isAkashJob) return;
    void loadJobMeta();
  }, [isAkashJob, loadJobMeta]);

  useEffect(() => {
    if (!AUTO_OPEN || !identity || !jobId) return undefined;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 48;
    const intervalMs = 3500;

    const tryOnce = async () => {
      if (cancelled || sessionReady(sessionRef.current)) return "done";
      attempts += 1;
      setLoading(true);
      setError("");
      try {
        const wallet = signingWalletFromIdentity(identity);
        if (isAkashJob && aktAddress && identity.mnemonic) {
          const resolved = await loadJobMeta();
          if (!resolved?.provider || resolved.leaseState === "closed") {
            setError(
              resolved?.leaseState === "closed"
                ? "This GPU lease has ended."
                : "Job not found — check GPU Jobs for this rental.",
            );
            return "stop";
          }
          const res = await requestAkashTerminalSession({
            wallet,
            mnemonic: identity.mnemonic,
            owner: aktAddress,
            jobId,
            dseq: resolved.dseq,
            provider: resolved.provider,
            gseq: resolved.job?.gseq,
            oseq: resolved.job?.oseq,
            clientCertificate: readManifestCertificatePem(aktAddress),
          });
          if (cancelled) return "done";
          setSession(res);
          if (
            aktAddress &&
            resolved.dseq &&
            (res.mode === "ssh" || res.mode === "provider_shell")
          ) {
            markAkashDseqJobs(
              [aktAddress, ethAddress].filter(Boolean) as string[],
              resolved.dseq,
              {
                id: jobId,
                internal_status: "running",
                provider_status: "lease_active",
                lease_state: "active",
              },
            );
          }
          return "done";
        }
        const res = await requestGpuTerminalSession({ wallet, jobId });
        if (cancelled) return "done";
        setSession({ mode: "iframe", ...res });
        return "done";
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : "");
        if (attempts >= maxAttempts) {
          setError(msg || "Terminal session not ready yet.");
          return "stop";
        }
        setError(
          /still starting|waiting for provider|queued/i.test(msg)
            ? "Waiting for provider to start your GPU…"
            : msg.includes("queued") || msg.includes("running")
              ? "Waiting for provider…"
              : msg,
        );
        return "retry";
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = window.setInterval(async () => {
      const result = await tryOnce();
      if (result === "done" || result === "stop") window.clearInterval(timer);
    }, intervalMs);
    void tryOnce();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [identity, jobId, isAkashJob, aktAddress, loadJobMeta]);

  return (
    <div className="flex flex-1 flex-col">
      {!embedded ? (
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-elevated px-6">
          <h1 className="text-sm font-semibold text-text-primary">GPU terminal</h1>
          <span className="font-mono text-xs text-text-muted">{jobId}</span>
          {jobMeta?.title ? (
            <span className="hidden text-xs text-text-secondary sm:inline">{jobMeta.title}</span>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/app/gpu/jobs">Jobs</Link>
            </Button>
            <Button
              variant="secondary"
              className="h-9 px-3 text-xs"
              disabled={loading}
              onClick={() => void openSession()}
            >
              {loading ? "Connecting…" : "Reconnect"}
            </Button>
          </div>
        </header>
      ) : (
        <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2">
          <span className="truncate text-xs font-medium text-text-primary">
            {jobMeta?.title || "Session"}
          </span>
          <span className="font-mono text-[10px] text-text-muted">{jobId}</span>
          <Button
            variant="secondary"
            className="ml-auto h-8 px-2 text-xs"
            disabled={loading}
            onClick={() => void openSession()}
          >
            {loading ? "Connecting…" : "Reconnect"}
          </Button>
        </div>
      )}

      <div className={embedded ? "flex flex-1 flex-col p-3" : "flex flex-1 flex-col p-4"}>
        {error && !sessionReady(session) ? (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="space-y-2 p-4 text-sm text-amber-900">
              <p>{error}</p>
              {isAkashJob ? (
                <Button variant="secondary" className="h-8 text-xs" asChild>
                  <Link href="/app/gpu/jobs">Back to GPU Jobs</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {terminalUrl ? (
          <iframe
            title="GPU SSH terminal"
            src={terminalUrl}
            className="min-h-[480px] flex-1 rounded-xl border border-border-subtle bg-black"
            allow="clipboard-read; clipboard-write"
          />
        ) : session?.mode === "provider_shell" &&
          session.shell_jwt &&
          session.host_uri &&
          session.provider &&
          session.dseq &&
          akashProviderProxyWsUrl() ? (
          <AkashLeaseShellTerminal
            hostUri={session.host_uri}
            provider={session.provider}
            jwt={session.shell_jwt}
            dseq={session.dseq}
            gseq={session.gseq ?? 1}
            oseq={session.oseq ?? 1}
            service={session.service}
            sshHint={session.ssh ?? null}
          />
        ) : (session?.mode === "provider_shell" || session?.mode === "ssh") && session.ssh?.host ? (
          <div className="flex min-h-[520px] flex-1 flex-col gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-6">
            <p className="text-sm text-text-primary">Your GPU is running. Connect with SSH:</p>
            <p className="font-mono text-sm text-text-secondary">
              ssh root@{session.ssh.host} -p {session.ssh.port}
            </p>
            <Button
              variant="secondary"
              className="h-9 w-fit text-xs"
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `ssh root@${session.ssh!.host} -p ${session.ssh!.port}`,
                );
              }}
            >
              Copy SSH command
            </Button>
            <p className="text-xs text-text-muted">
              For an in-browser shell, set{" "}
              <code className="rounded bg-black/10 px-1">NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS</code>{" "}
              and run <code className="rounded bg-black/10 px-1">node scripts/akash-provider-proxy.mjs</code>.
            </p>
          </div>
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <CardContent className="space-y-3 p-8 text-center text-sm text-text-secondary">
              <p>{loading ? "Opening secure terminal session…" : "No active terminal session."}</p>
              {isAkashJob && jobMeta?.dseq ? (
                <p className="text-xs text-text-muted">
                  Akash lease dseq {jobMeta.dseq}
                  {jobMeta.lease_state ? ` · ${jobMeta.lease_state}` : ""}
                </p>
              ) : null}
              <Button className="h-9 px-3 text-xs" disabled={loading} onClick={() => void openSession()}>
                Open terminal
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
