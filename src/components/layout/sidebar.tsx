"use client";

import { NodeShareLogo } from "@/components/brand/nodeshare-logo";
import { APP_NAV_ITEMS } from "@/components/layout/nav-config";
import { useWalletSession } from "@/context/wallet-session";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border-subtle bg-white lg:flex">
      <div className="border-b border-border-subtle px-5 py-5">
        <NodeShareLogo size="sidebar" href="/app/dashboard" />
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-accent">
          Console
        </p>
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
                "rounded-[var(--radius-md)] border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-surface-accent text-accent"
                  : "border-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-border-subtle p-4">
        {ethAddress ? (
          <p className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-subtle px-3 py-2 font-mono text-[11px] text-text-secondary">
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
          className="block rounded-[var(--radius-md)] px-3 py-2 text-center text-xs text-text-muted transition-colors hover:bg-surface-accent hover:text-accent"
        >
          ← Marketing site
        </Link>
      </div>
    </aside>
  );
}
