import { DangerZone } from "@/components/settings/danger-zone";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border-subtle bg-surface-elevated/80 px-6 backdrop-blur-md">
        <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
      </header>
      <div className="max-w-2xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">Network</h2>
            <p className="text-sm text-text-secondary">
              Preferred providers, failover, and latency SLOs.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-text-secondary">Akash-first scheduling</span>
              <input type="checkbox" defaultChecked className="accent-accent" />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-text-secondary">Render fallback</span>
              <input type="checkbox" defaultChecked className="accent-accent" />
            </label>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-text-primary">Security</h2>
            <p className="text-sm text-text-secondary">
              Keys, sessions, and audit trail (wire to your KMS in production).
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="secondary">Rotate signing key</Button>
            <Button variant="ghost">Download audit log</Button>
          </CardContent>
        </Card>
        <DangerZone />
      </div>
    </div>
  );
}
