/**
 * Public Akash REST LCD bases (no trailing slash).
 * Omit endpoints that often return 501 for legacy paths (e.g. some publicnode mirrors).
 */
export const DEFAULT_AKASH_LCD_BASES = [
  "https://rest.akashnet.net",
  "https://akash-api.lavenderfive.com:443",
  "https://akash-api.polkachu.com",
  "https://rest-akash.ecostake.com",
] as const;

export const AKASH_FETCH_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "NodeShare/1.0 (+https://github.com/mozzdog69-ops/nodeshare)",
} as const;
