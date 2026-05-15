"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

type Node = { id: string; x: number; y: number; r: number };

const links: [string, string][] = [
  ["a", "b"],
  ["b", "c"],
  ["c", "d"],
  ["d", "e"],
  ["e", "a"],
  ["a", "c"],
  ["b", "e"],
  ["c", "f"],
  ["f", "g"],
  ["g", "h"],
  ["h", "d"],
];

export function NodeGraphBg({ variant = "hero" }: { variant?: "hero" | "light" }) {
  const nodes = useMemo<Node[]>(
    () => [
      { id: "a", x: 18, y: 42, r: 3.2 },
      { id: "b", x: 38, y: 22, r: 2.6 },
      { id: "c", x: 58, y: 38, r: 3.4 },
      { id: "d", x: 78, y: 28, r: 2.8 },
      { id: "e", x: 88, y: 52, r: 3 },
      { id: "f", x: 42, y: 68, r: 2.4 },
      { id: "g", x: 62, y: 72, r: 2.9 },
      { id: "h", x: 82, y: 62, r: 2.5 },
    ],
    [],
  );

  const byId = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const isHero = variant === "hero";

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: isHero ? 0.7 : 0.45 }}
      transition={{ duration: 1.2 }}
    >
      <svg
        className={
          isHero
            ? "h-full w-full text-accent-hero/50"
            : "h-full w-full text-accent/35"
        }
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="pulse" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {links.map(([from, to], i) => {
          const a = byId[from];
          const b = byId[to];
          if (!a || !b) return null;
          return (
            <g key={`${from}-${to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                strokeWidth={0.15}
                opacity={0.35}
              />
              <motion.line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="url(#pulse)"
                strokeWidth={0.28}
                initial={{ opacity: 0.15 }}
                animate={{ opacity: [0.15, 0.85, 0.15] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.22,
                }}
              />
            </g>
          );
        })}
        {nodes.map((n, i) => (
          <motion.circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={n.r}
            className={isHero ? "fill-accent-hero/90" : "fill-accent/70"}
            animate={{ scale: [1, 1.08, 1], opacity: [0.75, 1, 0.75] }}
            transition={{
              duration: 3.5 + i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
      <motion.div
        className={
          isHero
            ? "absolute inset-0 bg-gradient-to-b from-surface-hero via-surface-hero/95 to-surface-base"
            : "absolute inset-0 bg-gradient-to-b from-surface-base via-transparent to-surface-base"
        }
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
    </motion.div>
  );
}
