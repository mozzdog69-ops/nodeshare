"use client";

import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { useWalletSession } from "@/context/wallet-session";
import Link from "next/link";

function shortAddr(a: string | null) {
  if (!a) return "";
  return `${a.slice(0, 4)}…${a.slice(-3)}`;
}

type Props = {
  onOpenMenu: () => void;
};

export function MobileHeader({ onOpenMenu }: Props) {
  const { ethAddress } = useWalletSession();

  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-elevated/90 px-3 py-2 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex h-11 min-w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl text-text-primary hover:bg-black/[0.04]"
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <NodeShareLogo size="nav" href="/app/dashboard" />
      </div>
      {ethAddress ? (
        <Link
          href="/app/wallet"
          className="shrink-0 rounded-full bg-surface-base px-2.5 py-1.5 font-mono text-[11px] text-text-secondary ring-1 ring-border-subtle"
        >
          {shortAddr(ethAddress)}
        </Link>
      ) : (
        <span className="w-11 shrink-0" aria-hidden />
      )}
    </header>
  );
}
