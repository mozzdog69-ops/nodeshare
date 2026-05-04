"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const lines = [
  { t: "GPU slot reserved (Akash)", c: "text-terminal-success" },
  { t: "Container pull: pytorch:2.2-cuda12", c: "text-terminal-fg" },
  { t: "VRAM: 22 / 24 GB", c: "text-terminal-dim" },
  { t: "Cost: $0.00 → ticking when running", c: "text-terminal-dim" },
];

export function LiveJobPanel() {
  const [cost, setCost] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setCost((c) => Math.round((c + 0.003 + Math.random() * 0.002) * 1000) / 1000);
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Live logs
        </p>
        <p className="mt-1 font-mono text-sm tabular-nums text-text-primary">
          Session cost{" "}
          <span className="font-semibold text-accent">${cost.toFixed(3)}</span>
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-4 font-mono text-xs leading-relaxed">
        {lines.map((l, i) => (
          <motion.p
            key={l.t}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className={`${l.c}`}
          >
            <span className="text-accent">▸</span> {l.t}
          </motion.p>
        ))}
        <motion.span
          className="inline-block h-3 w-1.5 animate-cursor-pulse rounded-sm bg-terminal-accent align-middle"
          aria-hidden
        />
      </div>
    </div>
  );
}
