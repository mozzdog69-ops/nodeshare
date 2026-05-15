"use client";

import { fetchApiJson } from "@/lib/fetch-api";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function MeshStatusBadge() {
  const [tone, setTone] = useState<"live" | "empty" | "error" | "pending">("pending");

  const load = useCallback(async () => {
    const got = await fetchApiJson<{
      ok: boolean;
      data?: { orders?: unknown[] };
    }>("/api/akash/market?limit=8");
    if (!got.ok) {
      setTone("error");
      return;
    }
    const j = got.body;
    if (!j.ok) {
      setTone("error");
      return;
    }
    const n = j.data?.orders?.length ?? 0;
    setTone(n > 0 ? "live" : "empty");
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [load]);

  const label =
    tone === "pending"
      ? "Checking LCD…"
      : tone === "live"
        ? "Mesh live"
        : tone === "empty"
          ? "Mesh quiet"
          : "LCD unavailable";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "live" && "border-accent/30 bg-surface-accent text-accent",
        tone === "empty" && "border-border-subtle bg-surface-subtle text-text-muted",
        tone === "error" && "border-amber-200 bg-warning-muted text-warning",
        tone === "pending" && "border-border-subtle bg-white text-text-muted",
      )}
    >
      {tone === "live" ? (
        <span className="size-1.5 rounded-full bg-live animate-pulse" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}
