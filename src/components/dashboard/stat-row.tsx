import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
};

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn(
            "rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated px-4 py-3 shadow-card",
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
