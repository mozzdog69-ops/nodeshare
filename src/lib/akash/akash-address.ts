/** Akash bech32 account address (akash1 + 38 chars). */
export function isValidAkashAddress(value: string | null | undefined): boolean {
  return /^akash1[a-z0-9]{38}$/.test(String(value || "").trim().toLowerCase());
}

export function sanitizeAkashAddress(value: string | null | undefined): string {
  const a = String(value || "").trim().toLowerCase();
  return isValidAkashAddress(a) ? a : "";
}
