/** Akash mainnet defaults — override via env for testnets or custom RPC. */

export const AKASH_MAINNET_CHAIN_ID = "akashnet-2";



export const UAKT_PER_AKT = 1_000_000;

/** ACT is the post-BME compute credit (USD-pegged, 6 decimals). */

export const UACT_PER_ACT = 1_000_000;

export const AKASH_COMPUTE_DENOM = "uact";

/** On-chain BME minimum mint output per burn-mint tx (10 ACT). */
export const BME_MIN_MINT_UACT = 10_000_000;

/** BME mint spread — 25 bps (0.25%), not 12%. */
export const BME_MINT_SPREAD_BPS = 25;

/** ACT is pegged to ~$1 USD of compute credit. */
export const ACT_USD_PEG = 1;

export function getAkashChainId(): string {
  return (
    process.env.NEXT_PUBLIC_AKASH_CHAIN_ID?.trim() ||
    process.env.AKASH_CHAIN_ID?.trim() ||
    AKASH_MAINNET_CHAIN_ID
  );
}

export function getAkashRpcUrl(): string {

  const url =

    process.env.NEXT_PUBLIC_AKASH_RPC_URL?.trim() ||

    process.env.AKASH_RPC_URL?.trim() ||

    "https://rpc.akashnet.net:443";

  return url.replace(/\/$/, "");

}



export function getAkashLcdUrl(): string {

  const url =

    process.env.NEXT_PUBLIC_AKASH_LCD_URL?.trim() ||

    process.env.AKASH_LCD_URL?.trim() ||

    "https://api.akashnet.net";

  return url.replace(/\/$/, "");

}



export function getGpuAktTreasury(): string {

  const a = String(

    process.env.NEXT_PUBLIC_GPU_AKT_TREASURY_ADDRESS ||

      process.env.NEXT_PUBLIC_GPU_TREASURY_ADDRESS ||

      "",

  ).trim();

  if (/^akash1[a-z0-9]{38}$/.test(a)) return a;

  throw new Error(

    "Set NEXT_PUBLIC_GPU_AKT_TREASURY_ADDRESS to an akash1… treasury wallet for AKT checkout.",

  );

}

