"use client";

import type { RentWaitEstimate } from "@/lib/akash/rent-wait-estimate";
import { rentWaitToneClass } from "@/lib/akash/rent-wait-estimate";
import { cn } from "@/lib/utils";

type Props = {
  estimate: RentWaitEstimate;
  className?: string;
  showDetail?: boolean;
};

export function GpuRentWaitBadge({ estimate, className, showDetail = false }: Props) {
  return (
    <div className={cn("space-y-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1",
          rentWaitToneClass(estimate.tone),
        )}
      >
        {estimate.badge}
      </span>
      {showDetail ? (
        <p className="text-[11px] leading-snug text-text-secondary">
          {estimate.bidWaitLabel} · {estimate.setupLabel}
        </p>
      ) : null}
    </div>
  );
}
