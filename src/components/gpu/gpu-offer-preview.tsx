import { GpuGraphicsCardIcon } from "@/components/gpu/gpu-graphics-card-icon";
import { formatGpuHeadline } from "@/lib/gpu/gpu-display";
import { cn } from "@/lib/utils";

type Props = {
  gpuModel?: string | null;
  title?: string;
  resourceChips?: string[];
  hasGpu?: boolean;
  provider?: string;
  region?: string;
  orderRef?: string;
  priceHourly?: string | null;
  size?: "sm" | "lg";
  className?: string;
};

export function GpuOfferPreview({
  gpuModel,
  title,
  resourceChips = [],
  hasGpu,
  provider,
  region,
  orderRef,
  priceHourly,
  size = "sm",
  className,
}: Props) {
  const { headline, subline, isGpu } = formatGpuHeadline({
    gpuModel,
    title,
    resourceChips,
    hasGpu,
  });
  const large = size === "lg";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border-subtle",
        isGpu ? "bg-gradient-to-br from-surface-accent via-white to-surface-subtle" : "bg-surface-subtle",
        className,
      )}
    >
      <div className={cn("flex gap-4", large ? "p-5" : "p-4")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl ring-1",
            isGpu
              ? "bg-accent text-white ring-accent/20 shadow-[var(--shadow-red)]"
              : "bg-white text-text-muted ring-border-subtle",
            large ? "h-20 w-20" : "h-14 w-14",
          )}
        >
          <GpuGraphicsCardIcon className={cn(large ? "h-10 w-10" : "h-8 w-8", isGpu ? "text-white" : "text-accent")} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-accent">{subline}</p>
          <p
            className={cn(
              "mt-0.5 font-bold leading-tight tracking-tight text-text-primary",
              large ? "text-2xl" : "text-base",
            )}
          >
            {headline}
          </p>
          {(provider || region) && (
            <p className="mt-1 text-xs text-text-secondary">
              {[provider, region].filter(Boolean).join(" · ")}
            </p>
          )}
          {priceHourly ? (
            <p className={cn("mt-2 font-mono font-semibold tabular-nums text-accent", large ? "text-lg" : "text-sm")}>
              {priceHourly}
            </p>
          ) : null}
        </div>
      </div>

      {resourceChips.length > 0 ? (
        <div className={cn("flex flex-wrap gap-1.5 border-t border-border-subtle/80 bg-white/50", large ? "px-5 py-3" : "px-4 py-2.5")}>
          {resourceChips.map((chip) => (
            <span
              key={chip}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                /gpu|nvidia|amd|a100|h100|rtx/i.test(chip)
                  ? "border-accent/25 bg-accent-muted text-accent"
                  : "border-border-subtle bg-surface-base text-text-secondary",
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {orderRef ? (
        <p className={cn("font-mono text-[10px] text-text-muted", large ? "px-5 pb-4" : "px-4 pb-3")}>
          {orderRef}
        </p>
      ) : null}
    </div>
  );
}
