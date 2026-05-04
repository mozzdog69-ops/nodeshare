import { LiveJobPanel } from "@/components/terminal/live-job-panel";
import { NodeTerminal } from "@/components/terminal/node-terminal";
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
          session · us-east-1
        </span>
      </header>
      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_340px] lg:p-6">
        <NodeTerminal />
        <LiveJobPanel />
      </div>
    </div>
  );
}
