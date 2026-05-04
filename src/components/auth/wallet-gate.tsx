"use client";

import { useWalletSession } from "@/context/wallet-session";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function WalletGate({ children }: { children: React.ReactNode }) {
  const { hydrated, status } = useWalletSession();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    if (status === "locked") router.replace("/login");
    if (status === "no_vault") router.replace("/onboarding");
  }, [hydrated, status, router]);

  if (!hydrated || status !== "unlocked") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-base px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        <p className="text-sm text-text-muted">Securing your console…</p>
      </div>
    );
  }

  return <>{children}</>;
}
