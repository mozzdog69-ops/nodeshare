"use client";

import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileQuickBar } from "@/components/layout/mobile-quick-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { useState, type ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-[100dvh] min-h-screen bg-surface-subtle">
      <div className="hidden w-1 shrink-0 self-stretch bg-accent lg:block" aria-hidden />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <MobileHeader onOpenMenu={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:min-h-screen lg:pb-0">
          {children}
        </div>
        <MobileQuickBar />
      </div>
    </div>
  );
}
