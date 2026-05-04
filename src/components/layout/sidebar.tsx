"use client";

import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { APP_NAV_ITEMS } from "@/components/layout/nav-config";
import { useWalletSession } from "@/context/wallet-session";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function shortAddr(a: string | null) {
  if (!a) return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { ethAddress, lockSession } = useWalletSession();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-elevated/80 backdrop-blur-md lg:flex">
      <div className="flex min-h-14 flex-col justify-center gap-1 border-b border-border-subtle px-4 py-3">
        <NodeShareLogo size="sidebar" href="/" />
        <p className="text-[11px] text-text-muted">Decentralized AI compute</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {APP_NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/app/dashboard" && pathname === "/app");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-text-primary"
                  : "text-text-secondary hover:bg-black/[0.03] hover:text-text-primary",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-accent-muted"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border-subtle p-3 space-y-2">
        {ethAddress ? (
          <p className="rounded-lg bg-surface-base px-3 py-2 font-mono text-[11px] text-text-secondary">
            {shortAddr(ethAddress)}
          </p>
        ) : null}
        <Button
          variant="secondary"
          className="w-full py-2 text-xs"
          onClick={() => {
            lockSession();
            router.push("/login");
          }}
        >
          Log out
        </Button>
        <Link
          href="/"
          className="block rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-black/[0.03] hover:text-text-secondary"
        >
          ← Landing
        </Link>
      </div>
    </aside>
  );
}
