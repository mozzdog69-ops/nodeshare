import { LiveJobHistory } from "@/components/history/live-job-history";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job history",
};

export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Job history</h1>
      </header>
      <div className="p-6">
        <LiveJobHistory />
      </div>
    </div>
  );
}
