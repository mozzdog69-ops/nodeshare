import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
};

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn(
            "min-w-[min(100%,280px)] shrink-0 snap-start rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-4 py-3 shadow-card sm:min-w-0",
            s.emphasize && "border-accent/20 ring-1 ring-accent/10",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {s.label}
          </p>
          <p
            className={cn(
              "mt-1 font-mono text-lg font-semibold tracking-tight tabular-nums text-text-primary",
              s.emphasize && "text-accent",
            )}
          >
            {s.value}
          </p>
          {s.hint ? (
            <p className="mt-0.5 text-xs text-text-muted">{s.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
