import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job history",
};

const jobs = [
  {
    id: "#4821",
    status: "done" as const,
    cost: "$0.42",
    provider: "Akash · US-East",
    logs: true,
  },
  {
    id: "#4819",
    status: "running" as const,
    cost: "$1.10",
    provider: "Render · EU",
    logs: true,
  },
  {
    id: "#4810",
    status: "failed" as const,
    cost: "$0.08",
    provider: "Akash · AP",
    logs: true,
  },
] as const;

const statusStyle = {
  done: "bg-success-muted text-success",
  running: "bg-warning-muted text-warning",
  failed: "bg-red-500/10 text-red-600",
};

export default function HistoryPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Job history</h1>
      </header>
      <div className="space-y-4 p-6">
        {jobs.map((j) => (
          <Card key={j.id} interactive>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-text-primary">
                    Job {j.id}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle[j.status]}`}
                  >
                    {j.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{j.provider}</p>
                <p className="mt-1 font-mono text-xs text-text-muted">
                  Cost {j.cost}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Logs</Button>
                <Button variant="ghost">Replay</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
