/**
 * Akash mainnet REST LCD bases (Cosmos REST / gRPC-gateway).
 * Source of truth: https://github.com/cosmos/chain-registry/blob/master/akash/chain.json → apis.rest
 * Market orders (Node v2): `/akash/market/v1beta5/orders/list?…&filters.state=open`
 * (see `src/app/api/akash/market/route.ts`). Bases may end with `/api`.
 */
export const DEFAULT_AKASH_LCD_BASES = [
  "https://api.akashnet.net",
  "https://rest-akash.ecostake.com",
  "https://akash-api.polkachu.com",
  "https://akash-api.kleomedes.network",
  "https://api-akash-01.stakeflow.io",
  "https://akash-mainnet-rest.cosmonautstakes.com:443",
  "https://akash-api.w3coins.io",
  "https://akash-rest.publicnode.com",
  "https://akash-api.validatornode.com",
  "https://akash.api.arcturian.tech",
  "https://akash.api.pocket.network",
  "https://akash-api.lavenderfive.com:443",
  /** Some mirrors mount REST under /api */
  "https://akash.c29r3.xyz:443/api",
] as const;

export const AKASH_FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "NodeShare/1.0 (+https://github.com/mozzdog69-ops/nodeshare)",
} as const;

/** @internal tests */
export const AKASH_FETCH_TIMEOUT_MS = 22_000;
