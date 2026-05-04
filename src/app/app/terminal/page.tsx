import { TerminalView } from "@/components/terminal/terminal-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terminal",
};

export default function TerminalPage() {
  return (
    <div className="flex flex-1 flex-col bg-surface-base">
      <header className="flex h-14 shrink-0 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Terminal</h1>
        <span className="ml-auto font-mono text-xs text-text-muted">
          mesh · balance-gated
        </span>
      </header>
      <TerminalView />
    </div>
  );
}
