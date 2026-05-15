"use client";

import { motion } from "framer-motion";

type Props = {
  orderCount?: number;
  className?: string;
};

export function AkashMarketTrustBar({ orderCount, className = "" }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[var(--radius-lg)] border-2 border-border-accent bg-surface-accent px-4 py-3 text-xs text-text-secondary ${className}`}
    >
      <span className="flex items-center gap-2 font-bold text-accent">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-40" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        Akash mainnet
      </span>
      <span className="hidden h-3 w-px bg-border-strong sm:inline" aria-hidden />
      <span className="font-medium">Live LCD prices</span>
      {orderCount != null && orderCount > 0 ? (
        <>
          <span className="hidden h-3 w-px bg-border-strong sm:inline" aria-hidden />
          <span className="font-mono font-semibold tabular-nums text-text-primary">
            {orderCount} orders
          </span>
        </>
      ) : null}
    </motion.div>
  );
}
