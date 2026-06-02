"use client";

import { listTerminalReadyJobs } from "@/lib/akash/resolve-akash-gpu-job";
import type { GpuJob } from "@/lib/gpu/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { clsx } from "clsx";

type Props = {
  jobs: GpuJob[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (jobId: string) => void;
  onLoadTerminal: () => void;
  terminalActive: boolean;
};

function terminalReadyJobs(jobs: GpuJob[]) {
  return listTerminalReadyJobs(jobs);
}

export function GpuSessionPicker({
  jobs,
  loading,
  selectedId,
  onSelect,
  onLoadTerminal,
  terminalActive,
}: Props) {
  const ready = terminalReadyJobs(jobs);

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Active GPU sessions
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Select a rental, then load the provider SSH terminal.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {loading ? (
          <p className="text-sm text-text-muted">Loading rentals…</p>
        ) : ready.length === 0 ? (
          <div className="space-y-3 text-sm text-text-secondary">
            <p>No active GPU lease ready for terminal.</p>
            <Button asChild className="h-9 w-full text-xs">
              <Link href="/app/marketplace">Rent a GPU</Link>
            </Button>
            <Button variant="secondary" asChild className="h-9 w-full text-xs">
              <Link href="/app/gpu/jobs">GPU Jobs</Link>
            </Button>
          </div>
        ) : (
          ready.map((job) => {
            const selected = selectedId === job.id;
            return (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelect(job.id)}
                className={clsx(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                    : "border-border-subtle bg-surface-base hover:border-accent/40",
                )}
              >
                <p className="font-medium text-text-primary">{job.title || "GPU rental"}</p>
                <p className="mt-0.5 font-mono text-[11px] text-text-muted">{job.id}</p>
                {job.dseq != null ? (
                  <p className="mt-1 text-[11px] text-text-muted">dseq {job.dseq}</p>
                ) : null}
                <p className="mt-1 text-[11px] font-medium uppercase text-emerald-700">
                  {String(job.internal_status || "active")}
                </p>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-border-subtle p-3">
        <Button
          type="button"
          className="h-10 w-full text-sm"
          disabled={!selectedId || loading}
          onClick={onLoadTerminal}
        >
          {terminalActive ? "Reload terminal" : "Load terminal"}
        </Button>
      </div>
    </div>
  );
}

export { terminalReadyJobs };
