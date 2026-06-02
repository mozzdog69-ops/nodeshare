/** User-facing text for failed Akash chain transactions (CosmJS / chain-sdk). */
export function formatAkashTxError(error: unknown): string {
  const tx = (error as { txResponse?: { code?: number; rawLog?: string; codespace?: string } })
    ?.txResponse;
  const code = tx?.code;
  const rawLog = String(tx?.rawLog || "").trim();
  const base = error instanceof Error ? error.message : String(error);

  if (code === 11 || /out of gas/i.test(rawLog)) {
    return (
      "Lease transaction ran out of gas (code 11). Redeploy the latest NodeShare build, then tap Complete pending rent — your provider bids are still open and you will not pay escrow again."
    );
  }
  if (code === 5 || /insufficient funds|insufficient fee/i.test(rawLog)) {
    return "Not enough AKT for transaction fees. Keep ~0.2 AKT in your wallet for gas, refresh balance, and retry.";
  }
  if (rawLog && !base.includes(rawLog)) {
    return `${base}${rawLog.length > 200 ? ` — ${rawLog.slice(0, 200)}…` : ` — ${rawLog}`}`;
  }
  return base;
}
