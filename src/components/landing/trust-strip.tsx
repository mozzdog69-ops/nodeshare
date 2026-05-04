const partners = ["Akash", "Render", "Ethereum", "IPFS"] as const;

export function TrustStrip() {
  return (
    <div className="border-y border-border-subtle bg-surface-elevated/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Ecosystem
        </p>
        {partners.map((name) => (
          <span
            key={name}
            className="text-sm font-semibold tracking-tight text-text-secondary"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
