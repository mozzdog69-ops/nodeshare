"use client";

import { ActCreditsBanner } from "@/components/gpu/act-credits-banner";
import {
  DIRECT_RENT_STEPS,
  createInitialRentProgress,
  type DirectRentProgressSnapshot,
  type DirectRentStepId,
  type DirectRentStepStatus,
  akashTxExplorerUrl,
} from "@/lib/akash/direct-rent-steps";
import type { RentWaitEstimate } from "@/lib/akash/rent-wait-estimate";
import { cn } from "@/lib/utils";

type Props = {
  progress: DirectRentProgressSnapshot | null;
  /** Show all 5 steps as pending before rent starts. */
  showPreview?: boolean;
  /** Live ACT balance — shows success + next steps after mint step completes. */
  actBalance?: number | null;
  waitEstimate?: RentWaitEstimate | null;
  className?: string;
};

function StepIcon({ status }: { status: DirectRentStepStatus }) {
  if (status === "complete" || status === "skipped") {
    return (
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          status === "complete" ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600",
        )}
        aria-hidden
      >
        {status === "complete" ? "✓" : "—"}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white" aria-hidden>
        ✕
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-accent border-t-transparent animate-spin"
        aria-hidden
      />
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white" aria-hidden />
  );
}

export function DirectAkashRentTracker({
  progress,
  showPreview = false,
  actBalance,
  waitEstimate,
  className,
}: Props) {
  const snapshot = progress ?? (showPreview ? createInitialRentProgress() : null);
  if (!snapshot) return null;

  const isPreview = !progress && showPreview;

  const allComplete = DIRECT_RENT_STEPS.every(
    (s) => snapshot.steps[s.id].status === "complete" || snapshot.steps[s.id].status === "skipped",
  );

  const mintDone =
    snapshot.steps.mint_act.status === "complete" || snapshot.steps.mint_act.status === "skipped";
  const showAfterMintGuide =
    !isPreview &&
    mintDone &&
    !allComplete &&
    !snapshot.failedStep &&
    actBalance != null &&
    actBalance >= 0.5;

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-white/90 px-4 py-3",
        snapshot.failedStep && "border-amber-300/80 ring-1 ring-amber-200/50",
        allComplete && !snapshot.failedStep && "border-emerald-300/80",
        isPreview && "border-border-subtle",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {isPreview ? "On-chain rent — 5 steps" : "On-chain rent progress"}
      </p>
      {isPreview ? (
        <p className="mt-0.5 text-[11px] text-text-secondary">
          After you tap Rent GPU, each step updates live until your lease is active.
          {waitEstimate ? (
            <>
              {" "}
              Expected: {waitEstimate.bidWaitLabel} · {waitEstimate.setupLabel}
            </>
          ) : null}
        </p>
      ) : null}
      {snapshot.dseq != null ? (
        <p className="mt-0.5 font-mono text-[11px] text-text-secondary">
          Deployment dseq <span className="font-semibold text-text-primary">{snapshot.dseq}</span>
        </p>
      ) : null}

      {showAfterMintGuide ? (
        <ActCreditsBanner actBalance={actBalance} variant="after-mint" className="mt-3" />
      ) : null}

      <ol className="mt-3 space-y-0">
        {DIRECT_RENT_STEPS.map((def, index) => {
          const state = snapshot.steps[def.id];
          const isLast = index === DIRECT_RENT_STEPS.length - 1;
          return (
            <li key={def.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <StepIcon status={state.status} />
                {!isLast ? <div className="my-0.5 w-px flex-1 min-h-[12px] bg-border-subtle" /> : null}
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-3")}>
                <p
                  className={cn(
                    "text-sm font-medium",
                    state.status === "active" && "text-accent",
                    state.status === "complete" && "text-emerald-800",
                    state.status === "error" && "text-rose-800",
                    state.status === "skipped" && "text-text-muted",
                    state.status === "pending" && "text-text-muted",
                  )}
                >
                  {def.label}
                </p>
                {state.detail ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-text-secondary">{state.detail}</p>
                ) : null}
                {def.id === "provider_bids" &&
                waitEstimate &&
                (state.status === "active" || state.status === "pending" || isPreview) ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                    Typical wait: {waitEstimate.bidWaitLabel}
                    {waitEstimate.bidMaxMinutes > 0
                      ? ` (up to ~${waitEstimate.bidMaxMinutes} min before timeout)`
                      : ""}
                  </p>
                ) : null}
                {state.txHash ? (
                  <a
                    href={akashTxExplorerUrl(state.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[10px] text-accent underline"
                  >
                    View tx {state.txHash.slice(0, 10)}…
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {allComplete && !snapshot.failedStep ? (
        <p className="mt-2 text-sm font-medium text-emerald-800">GPU lease active — opening terminal…</p>
      ) : isPreview ? (
        <p className="mt-2 text-xs text-text-muted">
          1. Mint ACT → 2. Create deployment → 3. Provider bids → 4. Accept lease → 5. Send manifest
        </p>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">{snapshot.message}</p>
      )}
    </div>
  );
}

export type { DirectRentProgressSnapshot, DirectRentStepId };
