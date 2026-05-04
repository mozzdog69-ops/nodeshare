"use client";

import { motion } from "framer-motion";
import { fetchApiJson } from "@/lib/fetch-api";
import { useWalletSession } from "@/context/wallet-session";
import { useCallback, useEffect, useState } from "react";

type Ev = { id: string; text: string; tone: "success" | "warning" | "neutral" };

const toneClass = {
  success: "text-success",
  warning: "text-warning",
  neutral: "text-text-secondary",
};

export function ActivityFeed() {
  const { ethAddress } = useWalletSession();
  const [events, setEvents] = useState<Ev[]>([]);

  const load = useCallback(async () => {
    const [mGot, tGot] = await Promise.all([
      fetchApiJson<{
        ok: boolean;
        data?: { orders?: unknown[]; source?: string };
        error?: string;
      }>("/api/akash/market?limit=12"),
      ethAddress
        ? fetchApiJson<{
            ok: boolean;
            data?: {
              transfers?: { hash: string; symbol: string; timestamp: number }[];
            };
            error?: string;
          }>(
            `/api/chain/transactions?address=${encodeURIComponent(ethAddress)}`,
          )
        : Promise.resolve(null as Awaited<ReturnType<typeof fetchApiJson>> | null),
    ]);

    const next: Ev[] = [];

    if (!mGot.ok) {
      next.push({ id: "akash-net", text: mGot.error, tone: "warning" });
    }

    const mj = mGot.ok
      ? mGot.body
      : { ok: false as const, error: undefined, data: undefined };
    if (mGot.ok) {
      if (mj.ok && mj.data?.orders?.length) {
        next.push({
          id: "akash",
          text: `${mj.data.orders.length} open Akash order(s) on this LCD page`,
          tone: "success",
        });
      } else if (!mj.ok && mj.error) {
        next.push({
          id: "akash-fail",
          text: mj.error,
          tone: "warning",
        });
      }
    }

    if (tGot) {
      if (!tGot.ok) {
        next.push({ id: "tx-net", text: tGot.error, tone: "warning" });
      } else {
        const tj = tGot.body as {
          ok: boolean;
          error?: string;
          data?: {
            transfers?: { hash: string; symbol: string; timestamp: number }[];
          };
        };
        const tr = tj.data?.transfers?.[0];
        if (tj.ok && tr) {
          next.push({
            id: `tx-${tr.hash}`,
            text: `Latest ${tr.symbol} · ${new Date(tr.timestamp).toLocaleString()}`,
            tone: "neutral",
          });
        } else if (!tj.ok && tj.error) {
          next.push({
            id: "tx-fail",
            text: tj.error,
            tone: "warning",
          });
        }
      }
    }

    setEvents(next.slice(0, 6));
  }, [ethAddress]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Live activity
        </h3>
        <button
          type="button"
          className="text-xs font-medium text-accent hover:underline"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {events.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-4 text-sm text-text-muted">
          No activity yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <motion.li
              key={`${e.id}-${i}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 text-sm"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  e.tone === "success"
                    ? "bg-success"
                    : e.tone === "warning"
                      ? "bg-warning"
                      : "bg-text-muted"
                }`}
              />
              <span className={toneClass[e.tone]}>{e.text}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
