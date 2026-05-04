"use client";

/**
 * Placeholder until provider log streaming is wired. No simulated costs or fake job lines.
 */
export function LiveJobPanel() {
  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-[var(--radius-md)] border border-border-subtle bg-surface-elevated">
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Session side panel
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Attach a deployment through Akash (CLI / Console); live provider logs are not
          streamed here yet.
        </p>
      </div>
      <div className="flex flex-1 flex-col justify-center p-4 text-sm text-text-muted">
        <p>
          Reserve capacity from the{" "}
          <span className="font-medium text-text-secondary">Marketplace</span>, fund your
          wallet, then use provider tooling for manifests and log streams.
        </p>
      </div>
    </div>
  );
}
