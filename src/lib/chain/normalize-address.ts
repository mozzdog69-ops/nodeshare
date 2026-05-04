import { getAddress } from "ethers";

export function isHexAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

/**
 * Returns EIP-55 checksummed address. Accepts valid 20-byte hex in any casing
 * (avoids "bad address checksum" when query strings use wrong mixed-case).
 */
export function normalizeHexAddress(raw: string): string {
  if (!isHexAddress(raw)) {
    throw new Error("Invalid address");
  }
  return getAddress(raw.toLowerCase());
}
