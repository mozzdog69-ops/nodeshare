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
        "rounded-full border px-3 py-1 text-xs font-medium",
        tone === "live" &&
          "border-success-muted bg-success-muted text-success",
        tone === "empty" &&
          "border-border-subtle bg-surface-base text-text-muted",
        tone === "error" &&
          "border-amber-200 bg-amber-50 text-amber-900",
        tone === "pending" &&
          "border-border-subtle bg-surface-base text-text-muted",
      )}
    >
      {label}
    </span>
  );
}
