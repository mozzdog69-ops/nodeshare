import type { VaultBlob } from "@/lib/wallet/vault-types";
import { VAULT_STORAGE_KEY } from "@/lib/wallet/vault-types";

const LEGACY_VAULT_KEY = "nodeshare_vault_v1";

export function readVaultBlob(): VaultBlob | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VaultBlob;
    if (parsed?.v !== 2 || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeVaultBlob(blob: VaultBlob): void {
  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(blob));
}

export function clearVaultBlob(): void {
  window.localStorage.removeItem(VAULT_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_VAULT_KEY);
}

export function hasVaultOnDevice(): boolean {
  return readVaultBlob() !== null;
}
