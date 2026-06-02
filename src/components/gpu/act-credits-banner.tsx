"use client";

import { formatActDisplay } from "@/lib/gpu/quote-utils";
import { cn } from "@/lib/utils";

type Props = {
  actBalance: number;
  /** Shown on checkout when user already minted (follow-up rent). */
  variant?: "wallet" | "after-mint" | "checkout-ready";
  className?: string;
};

export function ActCreditsBanner({ actBalance, variant = "wallet", className }: Props) {
  if (!Number.isFinite(actBalance) || actBalance < 0.5) return null;

  const actLabel = formatActDisplay(actBalance);

  if (variant === "after-mint") {
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-300/90 bg-emerald-50/95 px-3 py-3 text-sm text-emerald-950",
          className,
        )}
        role="status"
      >
        <p className="font-semibold">ACT mint successful — {actLabel} in your wallet</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-900/90">
          Your AKT was converted to Akash compute credits (ACT). NodeShare will continue automatically:
          create deployment → wait for provider bid → accept lease → send manifest to the GPU host.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-emerald-900/90">
          <li>Watch the steps below — each one turns green when done.</li>
          <li>Only about <strong>0.5 ACT</strong> goes to escrow for this rental; the rest (~{actLabel}) stays for later GPUs.</li>
          <li>Keep a little <strong>AKT</strong> in the wallet for on-chain gas (lease + manifest).</li>
          <li>When all five steps are complete, you are renting — the GPU terminal opens.</li>
        </ol>
      </div>
    );
  }

  if (variant === "checkout-ready") {
    return (
      <div
        className={cn(
          "rounded-lg border border-emerald-300/90 bg-emerald-50/95 px-3 py-3 text-sm text-emerald-950",
          className,
        )}
        role="status"
      >
        <p className="font-semibold">ACT compute credits: {actLabel}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/90">
          You already minted ACT — you do <strong>not</strong> need another large AKT top-up. Tap{" "}
          <strong>Rent GPU</strong> below; only ~0.5 ACT escrow plus a small amount of AKT for gas is required.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/90">
          <strong>What happens next:</strong> NodeShare posts your deployment on Akash, waits for the provider to
          bid, accepts the lease, then sends the manifest so your container starts.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-emerald-300/90 bg-emerald-50/95 px-3 py-3 text-sm text-emerald-950",
        className,
      )}
      role="status"
    >
      <p className="font-semibold">ACT mint successful — compute credits: {actLabel}</p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-900/90">
        These credits live in your Akash wallet (not lost). Each GPU rental uses about <strong>0.5 ACT</strong> for
        on-chain escrow; the rest stays for your next rental.
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/90">
        <strong>What to do next:</strong> choose a GPU, tap <strong>Rent GPU</strong>, and wait for all on-chain steps
        to complete (deployment → provider bid → lease → manifest). Keep some <strong>AKT</strong> for gas.
      </p>
    </div>
  );
}
