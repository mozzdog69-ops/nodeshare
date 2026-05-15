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
      animate={{ opacity: isHero ? 1 : 0.5 }}
      transition={{ duration: 1 }}
    >
      <svg
        className="h-full w-full text-accent/40"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="pulse-red" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.85" />
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
                strokeWidth={0.12}
                opacity={0.25}
              />
              <motion.line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="url(#pulse-red)"
                strokeWidth={0.22}
                initial={{ opacity: 0.1 }}
                animate={{ opacity: [0.1, 0.7, 0.1] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
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
            className="fill-accent"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.95, 0.5] }}
            transition={{
              duration: 3.5 + i * 0.2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white" />
    </motion.div>
  );
}
