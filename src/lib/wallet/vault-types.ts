export type VaultBlob = {
  /** v2: AES key derived from PBKDF2(normalized recovery phrase) only — no device password. */
  v: 2;
  salt: string;
  iv: string;
  ciphertext: string;
};

/** Bumped so legacy password-based (v1) blobs are not read as valid vaults. */
export const VAULT_STORAGE_KEY = "nodeshare_vault_v2";
