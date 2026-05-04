"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Pop = {
  id: string;
  label: string;
  x: number;
  y: number;
  latency: string;
  cost: string;
  gpu: string;
  provider: "Akash" | "Render" | "Hybrid";
};

const pops: Pop[] = [
  {
    id: "nyc",
    label: "US-East",
    x: 26,
    y: 38,
    latency: "18 ms",
    cost: "$0.42/hr",
    gpu: "RTX 4090",
    provider: "Akash",
  },
  {
    id: "fra",
    label: "EU-Central",
    x: 52,
    y: 34,
    latency: "42 ms",
    cost: "$0.38/hr",
    gpu: "A100 40G",
    provider: "Akash",
  },
  {
    id: "sgp",
    label: "AP-South",
    x: 76,
    y: 52,
    latency: "61 ms",
    cost: "$0.51/hr",
    gpu: "L40S",
    provider: "Render",
  },
  {
    id: "sfo",
    label: "US-West",
    x: 14,
    y: 42,
    latency: "24 ms",
    cost: "$0.45/hr",
    gpu: "A10",
    provider: "Hybrid",
  },
];

export function ComputeNetworkMap() {
  const [selected, setSelected] = useState<Pop | null>(null);
  const curves = useMemo(
    () => [
      "M 20 45 Q 40 28 55 38",
      "M 55 38 Q 68 30 78 50",
      "M 30 40 Q 48 55 72 52",
    ],
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-surface-elevated shadow-card">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(225,29,72,0.06),_transparent_55%)]" />
      <div className="relative grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="relative aspect-[16/10] min-h-[320px] w-full">
          <svg
            className="absolute inset-0 h-full w-full text-accent/25"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <pattern
                id="grid"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 6 0 L 0 0 0 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={0.15}
                />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" opacity={0.5} />
            {curves.map((d, i) => (
              <motion.path
                key={d}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.35}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ duration: 1.2, delay: 0.1 * i }}
              />
            ))}
          </svg>
          {pops.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelected(n)}
              className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
            >
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/35 opacity-60" />
                <span
                  className={cn(
                    "relative inline-flex h-3 w-3 rounded-full shadow-[0_0_12px_rgba(225,29,72,0.55)]",
                    selected?.id === n.id
                      ? "bg-accent ring-2 ring-white"
                      : "bg-accent/90",
                  )}
                />
              </span>
            </button>
          ))}
        </div>
        <aside className="border-t border-border-subtle bg-surface-base/50 p-5 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-semibold text-text-primary">Node detail</h3>
          {selected ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Region
                </dt>
                <dd className="font-medium text-text-primary">{selected.label}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Latency
                </dt>
                <dd className="font-mono tabular-nums">{selected.latency}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Spot price
                </dt>
                <dd className="font-mono font-semibold text-accent">
                  {selected.cost}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  GPU
                </dt>
                <dd>{selected.gpu}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Provider
                </dt>
                <dd>{selected.provider}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              Select a glowing node to inspect latency, cost, and GPU type.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
