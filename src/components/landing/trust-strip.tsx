const partners = ["Akash mainnet", "Ethereum", "USDC / USDT", "On-chain bids"] as const;

export function TrustStrip() {
  return (
    <div className="bg-surface-accent">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-6">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Powered by
        </p>
        {partners.map((name) => (
          <span
            key={name}
            className="text-sm font-semibold text-text-primary"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
