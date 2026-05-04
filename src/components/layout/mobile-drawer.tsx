"use client";

import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { APP_NAV_ITEMS } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/context/wallet-session";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

function shortAddr(a: string | null) {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { ethAddress, lockSession } = useWalletSession();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="absolute left-0 top-0 flex h-full w-[min(100vw-2.5rem,20rem)] flex-col border-r border-border-subtle bg-surface-elevated shadow-2xl"
      >
        <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
          <NodeShareLogo size="sidebar" href="/" />
          <button
            type="button"
            className="flex h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-text-muted hover:bg-black/[0.04] hover:text-text-primary"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="px-4 pb-2 pt-1 text-[11px] text-text-muted">Decentralized AI compute</p>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          {APP_NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/app/dashboard" && pathname === "/app");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "min-h-12 touch-manipulation rounded-xl px-4 py-3 text-base font-medium transition-colors",
                  active
                    ? "bg-accent-muted text-accent"
                    : "text-text-secondary hover:bg-black/[0.04] hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-subtle p-4 space-y-3">
          {ethAddress ? (
            <p className="rounded-lg bg-surface-base px-3 py-2 font-mono text-[11px] text-text-secondary">
              {shortAddr(ethAddress)}
            </p>
          ) : null}
          <Button
            variant="secondary"
            className="w-full min-h-12 touch-manipulation py-3 text-sm"
            onClick={() => {
              lockSession();
              onClose();
              router.push("/login");
            }}
          >
            Log out
          </Button>
          <Link
            href="/"
            onClick={onClose}
            className="block min-h-12 touch-manipulation rounded-xl px-3 py-3 text-center text-sm text-text-muted hover:bg-black/[0.03]"
          >
            ← Landing
          </Link>
        </div>
      </div>
    </div>
  );
}
