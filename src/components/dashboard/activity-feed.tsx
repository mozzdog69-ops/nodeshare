"use client";

import { motion } from "framer-motion";
import { apiUrl } from "@/lib/api-base";
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
    const [mRes, tRes] = await Promise.all([
      fetch(apiUrl("/api/akash/market?limit=12")),
      ethAddress
        ? fetch(
            apiUrl(
              `/api/chain/transactions?address=${encodeURIComponent(ethAddress)}`,
            ),
          )
        : Promise.resolve(null as Response | null),
    ]);

    const next: Ev[] = [];

    const mj = (await mRes.json()) as {
      ok: boolean;
      data?: { orders?: unknown[]; source?: string };
      error?: string;
    };
    if (mj.ok && mj.data?.orders?.length) {
      next.push({
        id: "akash",
        text: `Akash mesh: ${mj.data.orders.length} open bids (sampled)`,
        tone: "success",
      });
      if (mj.data.source) {
        next.push({
          id: "lcd",
          text: `LCD ${mj.data.source.replace(/^https?:\/\//, "").split("/")[0]}`,
          tone: "neutral",
        });
      }
    } else {
      next.push({
        id: "akash-fail",
        text: mj.error
          ? `Akash market: ${mj.error}`
          : "Akash market: no orders returned",
        tone: "warning",
      });
    }

    if (tRes) {
      const tj = (await tRes.json()) as {
        ok: boolean;
        data?: { transfers?: { hash: string; symbol: string; timestamp: number }[] };
      };
      const tr = tj.data?.transfers?.[0];
      if (tj.ok && tr) {
        next.push({
          id: `tx-${tr.hash}`,
          text: `Latest ${tr.symbol}: ${new Date(tr.timestamp).toLocaleString()}`,
          tone: "neutral",
        });
      } else if (!tj.ok) {
        next.push({
          id: "tx-fail",
          text: "Stablecoin tx feed needs ETHERSCAN_API_KEY + wallet",
          tone: "warning",
        });
      }
    } else {
      next.push({
        id: "unlock",
        text: "Unlock wallet to stream your USDC/USDT activity here",
        tone: "neutral",
      });
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
      <ul className="space-y-2">
        {events.map((e, i) => (
          <motion.li
            key={e.id}
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
    </div>
  );
}
