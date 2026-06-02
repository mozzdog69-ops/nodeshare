"use client";

import { useWalletSession } from "@/context/wallet-session";
import { fetchApiJson } from "@/lib/fetch-api";
import { formatAktDisplay } from "@/lib/gpu/quote-utils";
import { useCallback, useEffect, useState } from "react";

type AktBankResponse = {
  ok: boolean;
  data?: {
    uakt: string;
    uact?: string;
    aktFormatted: string;
    actFormatted?: string;
    source?: string;
  };
  error?: string;
};

/** Live AKT + ACT on the Akash address derived from the unlocked NodeShare wallet. */
export function useLiveAktBalance(pollMs = 45_000) {
  const { aktAddress, status } = useWalletSession();
  const [aktBalance, setAktBalance] = useState<number | null>(null);
  const [actBalance, setActBalance] = useState<number | null>(null);
  const [aktFormatted, setAktFormatted] = useState<string | null>(null);
  const [actFormatted, setActFormatted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (status !== "unlocked" || !aktAddress) {
      setAktBalance(null);
      setActBalance(null);
      setAktFormatted(null);
      setActFormatted(null);
      setError(
        status === "locked"
          ? "Unlock your NodeShare wallet to see your AKT balance."
          : status === "no_vault"
            ? "Create or import a NodeShare wallet first."
            : null,
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const got = await fetchApiJson<AktBankResponse>(
        `/api/akash/bank?address=${encodeURIComponent(aktAddress)}`,
      );
      if (!got.ok) {
        setAktBalance(null);
        setActBalance(null);
        setAktFormatted(null);
        setActFormatted(null);
        setError(got.error);
        return;
      }
      const j = got.body;
      if (!j.ok || !j.data) {
        setAktBalance(null);
        setActBalance(null);
        setAktFormatted(null);
        setActFormatted(null);
        setError(j.error ?? "Could not read AKT from Akash LCD.");
        return;
      }
      const bal = Number(j.data.uakt) / 1_000_000;
      const actBal = Number(j.data.uact ?? 0) / 1_000_000;
      setAktBalance(Number.isFinite(bal) ? bal : 0);
      setActBalance(Number.isFinite(actBal) ? actBal : 0);
      setAktFormatted(j.data.aktFormatted ?? formatAktDisplay(bal));
      setActFormatted(
        j.data.actFormatted ??
          (Number.isFinite(actBal) && actBal > 0 ? `${actBal.toFixed(4)} ACT` : "0 ACT"),
      );
    } catch (e) {
      setAktBalance(null);
      setActBalance(null);
      setAktFormatted(null);
      setActFormatted(null);
      setError(e instanceof Error ? e.message : "Failed to load AKT balance.");
    } finally {
      setLoading(false);
    }
  }, [aktAddress, status]);

  useEffect(() => {
    void refresh();
    if (pollMs <= 0) return undefined;
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  const hasSufficientAkt = useCallback(
    (required: number) =>
      required <= 0 || (aktBalance != null && Number.isFinite(required) && aktBalance + 1e-9 >= required),
    [aktBalance],
  );

  return {
    aktAddress,
    aktBalance,
    actBalance,
    aktFormatted,
    actFormatted,
    loading,
    error,
    refresh,
    hasSufficientAkt,
    walletReady: status === "unlocked" && Boolean(aktAddress),
  };
}
