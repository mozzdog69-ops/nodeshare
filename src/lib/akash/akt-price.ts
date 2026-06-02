import { ACT_USD_PEG, BME_MINT_SPREAD_BPS } from "@/lib/akash/chain-config";

/** Fallback when env + live oracle unavailable (May 2026 mainnet ~$0.78). */
const DEFAULT_AKT_USD = 0.85;

/** Env override for AKT/USD — used when live fetch fails. */
export function getAktUsdEstimate(): number {
  const raw = process.env.NEXT_PUBLIC_AKT_USD_PRICE?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_AKT_USD;
}

/**
 * AKT burned to mint `mintAct` ACT via BME (excludes tx gas).
 * ACT is pegged at ACT_USD_PEG (~$1); burn AKT at aktUsd/AKT on-chain.
 */
export function aktBurnForActMint(mintAct: number, aktUsd = getAktUsdEstimate()): number {
  if (!Number.isFinite(mintAct) || mintAct <= 0) return 0;
  const price = Number.isFinite(aktUsd) && aktUsd > 0 ? aktUsd : DEFAULT_AKT_USD;
  const spread = BME_MINT_SPREAD_BPS / 10_000;
  return (mintAct * ACT_USD_PEG) / price / (1 - spread);
}

export async function fetchLiveAktUsd(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=akash-network&vs_currencies=usd",
    { signal: AbortSignal.timeout(12_000), next: { revalidate: 300 } },
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = (await res.json()) as { "akash-network"?: { usd?: number } };
  const usd = json["akash-network"]?.usd;
  if (!Number.isFinite(usd) || !usd || usd <= 0) throw new Error("Invalid AKT price");
  return usd;
}
