"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchApiJson } from "@/lib/fetch-api";
import { ordersToMapNodes, type MapNode } from "@/lib/akash/summarize";

export function ComputeNetworkMap() {
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const curves = useMemo(
    () => [
      "M 20 45 Q 40 28 55 38",
      "M 55 38 Q 68 30 78 50",
      "M 30 40 Q 48 55 72 52",
    ],
    [],
  );

  const load = useCallback(async () => {
    setErr(null);
    setInfo(null);
    try {
      const got = await fetchApiJson<{
        ok: boolean;
        data?: { orders?: unknown[]; source?: string };
        error?: string;
      }>("/api/akash/market?limit=24");
      if (!got.ok) {
        setNodes([]);
        setSource(null);
        setErr(got.error);
        return;
      }
      const j = got.body;
      if (!j.ok) {
        setNodes([]);
        setSource(null);
        setErr(j.error ?? "Akash market unavailable");
        return;
      }
      const orders = Array.isArray(j.data?.orders) ? j.data!.orders : [];
      setSource(j.data?.source ?? null);
      if (orders.length === 0) {
        setNodes([]);
        setSelected(null);
        setInfo(
          "LCD returned zero open orders (quiet market or try another REST node via AKASH_LCD_URL).",
        );
        return;
      }
      setNodes(ordersToMapNodes(orders));
      setSelected(null);
    } catch (e) {
      setNodes([]);
      setSource(null);
      setErr(e instanceof Error ? e.message : "Failed to load map");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          {err || info ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p
                className={
                  err
                    ? "max-w-sm text-sm text-amber-800"
                    : "max-w-sm text-sm text-text-secondary"
                }
              >
                {err ?? info}{" "}
                <button
                  type="button"
                  className="font-medium text-accent underline"
                  onClick={() => void load()}
                >
                  Retry
                </button>
              </p>
            </div>
          ) : (
            nodes.map((n) => (
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
            ))
          )}
        </div>
        <aside className="border-t border-border-subtle bg-surface-base/50 p-5 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-semibold text-text-primary">Node detail</h3>
          {source ? (
            <p className="mt-1 font-mono text-[10px] text-text-muted break-all">
              LCD: {source}
            </p>
          ) : null}
          {selected ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Order id
                </dt>
                <dd className="font-mono text-xs font-medium text-text-primary break-all">
                  {selected.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Latency (est.)
                </dt>
                <dd className="font-mono tabular-nums">{selected.latency}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Bid price
                </dt>
                <dd className="font-mono font-semibold text-accent">
                  {selected.cost}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Resources (hint)
                </dt>
                <dd>{selected.gpu}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-text-muted">
                  Layer
                </dt>
                <dd>{selected.provider}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-text-secondary">
              Select a glowing node to inspect bid price and resource hints from live
              Akash orders.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
