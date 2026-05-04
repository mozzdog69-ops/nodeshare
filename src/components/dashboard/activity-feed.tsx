"use client";

import { motion } from "framer-motion";

const events = [
  { id: 1, text: "GPU node joined network", tone: "success" as const },
  { id: 2, text: "Job #4821 completed · $0.42", tone: "neutral" as const },
  { id: 3, text: "Swap USDC → AKT confirmed", tone: "neutral" as const },
  { id: 4, text: "Queue: 2 jobs ahead of you", tone: "warning" as const },
];

const toneClass = {
  success: "text-success",
  warning: "text-warning",
  neutral: "text-text-secondary",
};

export function ActivityFeed() {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Live activity
      </h3>
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
