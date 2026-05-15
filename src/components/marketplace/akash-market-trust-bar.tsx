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
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border-subtle bg-surface-elevated/80 px-4 py-3 text-xs text-text-secondary shadow-card backdrop-blur-sm ${className}`}
    >
      <span className="flex items-center gap-2 font-medium text-text-primary">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-50" />
          <span className="relative inline-flex size-2 rounded-full bg-live" />
        </span>
        Akash mainnet · live LCD
      </span>
      <span className="hidden h-3 w-px bg-border-subtle sm:inline" aria-hidden />
      <span>v1beta5 open orders</span>
      <span className="hidden h-3 w-px bg-border-subtle sm:inline" aria-hidden />
      <span>Prices from chain</span>
      {orderCount != null && orderCount > 0 ? (
        <>
          <span className="hidden h-3 w-px bg-border-subtle sm:inline" aria-hidden />
          <span className="font-mono tabular-nums text-text-primary">{orderCount} on this page</span>
        </>
      ) : null}
    </motion.div>
  );
}
