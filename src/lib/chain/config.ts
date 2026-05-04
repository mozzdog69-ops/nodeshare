/** Default Ethereum mainnet — override via CHAIN_ID + token addresses in env. */
export const DEFAULT_CHAIN_ID = 1;

/** Canonical mainnet contracts (6 decimals each). */
export const MAINNET_TOKENS = {
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const,
};

export function getChainId(): number {
  const raw = process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID;
  const n = raw ? parseInt(raw, 10) : DEFAULT_CHAIN_ID;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CHAIN_ID;
}

export function getUsdcAddress(): string {
  return process.env.USDC_CONTRACT_ADDRESS ?? MAINNET_TOKENS.USDC;
}

export function getUsdtAddress(): string {
  return process.env.USDT_CONTRACT_ADDRESS ?? MAINNET_TOKENS.USDT;
}
