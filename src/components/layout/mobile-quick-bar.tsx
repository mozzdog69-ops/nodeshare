"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_QUICK_ITEMS } from "@/components/layout/nav-config";

function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(active ? "text-accent" : "text-text-muted")}
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function IconMarket({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(active ? "text-accent" : "text-text-muted")}
      aria-hidden
    >
      <path d="M6 8h15l-1.5 9h-12z" />
      <path d="M6 8 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function IconTerminal({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(active ? "text-accent" : "text-text-muted")}
      aria-hidden
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconWallet({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn(active ? "text-accent" : "text-text-muted")}
      aria-hidden
    >
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const icons = [IconDashboard, IconMarket, IconTerminal, IconWallet] as const;

export function MobileQuickBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
      aria-label="Quick navigation"
    >
      <div className="border-t border-border-subtle bg-surface-elevated/95 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-0 px-1 pt-1">
          {APP_QUICK_ITEMS.map((item, i) => {
            const active =
              pathname === item.href ||
              (item.href === "/app/dashboard" && pathname === "/app");
            const Icon = icons[i]!;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-[52px] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-colors",
                  active
                    ? "bg-accent-muted text-accent"
                    : "text-text-secondary active:bg-black/[0.04]",
                )}
              >
                <Icon active={active} />
                <span className="leading-none">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
