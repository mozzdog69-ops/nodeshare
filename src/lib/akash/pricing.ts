/** ~6s average block time on Akash mainnet (estimate for spot-rate math). */
export const AKASH_BLOCKS_PER_MONTH = Math.floor((30 * 24 * 3600) / 6);

/** Canonical mainnet IBC USDC on Akash (common denom). */
export const AKASH_IBC_USDC =
  "ibc/170c677610ac31df0904ffe09cd3b5c657492170e7e52372e48756b71e56f2f1";

export function isUsdcIbcDenom(denom: string): boolean {
  return denom.toLowerCase() === AKASH_IBC_USDC;
}

export function formatDenomLabel(denom: string): string {
  const d = denom.toLowerCase();
  if (d === "uakt" || d.endsWith("akt")) return "AKT";
  if (isUsdcIbcDenom(denom)) return "USDC";
  if (d.startsWith("ibc/")) return "IBC";
  return denom.length > 12 ? `${denom.slice(0, 10)}…` : denom;
}

export type FormattedPrice = {
  perBlock: string;
  note: string;
  monthlyEstimate: string | null;
};

export function formatAkashPrice(amount: string, denom: string): FormattedPrice {
  const n = Number(amount);
  const label = formatDenomLabel(denom);
  if (!Number.isFinite(n)) {
    return { perBlock: `${amount} ${label}`, note: "per block · Akash LCD", monthlyEstimate: null };
  }

  const d = denom.toLowerCase();
  if (d === "uakt" || d.endsWith("akt")) {
    const perBlock = n / 1_000_000;
    const monthly = perBlock * AKASH_BLOCKS_PER_MONTH;
    return {
      perBlock: `${perBlock < 0.0001 ? perBlock.toFixed(8) : perBlock < 0.01 ? perBlock.toFixed(6) : perBlock.toFixed(4)} AKT`,
      note: "per block · mainnet LCD",
      monthlyEstimate:
        monthly < 0.01
          ? `~${monthly.toFixed(6)} AKT / mo (est.)`
          : `~${monthly.toFixed(2)} AKT / mo (est.)`,
    };
  }

  if (isUsdcIbcDenom(denom)) {
    const perBlock = n / 1_000_000;
    const monthly = perBlock * AKASH_BLOCKS_PER_MONTH;
    return {
      perBlock: `$${perBlock < 0.0001 ? perBlock.toFixed(8) : perBlock < 0.01 ? perBlock.toFixed(6) : perBlock.toFixed(4)}`,
      note: "USDC per block · mainnet LCD",
      monthlyEstimate: `~$${monthly < 1 ? monthly.toFixed(4) : monthly.toFixed(2)} / mo (est.)`,
    };
  }

  if (d.startsWith("ibc/")) {
    const perBlock = n >= 1_000_000 ? n / 1_000_000 : n;
    return {
      perBlock: `${perBlock < 1 ? perBlock.toFixed(6) : perBlock.toFixed(4)} ${label}`,
      note: "per block · IBC · mainnet LCD",
      monthlyEstimate: null,
    };
  }

  return {
    perBlock: `${n < 1 ? n.toFixed(6) : n.toFixed(4)} ${label}`,
    note: "per block · mainnet LCD",
    monthlyEstimate: null,
  };
}
