import type { VaultBlob } from "@/lib/wallet/vault-types";

function normPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

function toB64(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]!);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKeyFromPhrase(
  normalizedPhrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalizedPhrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations: 210_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt canonical phrase for local storage; key material is the same normalized phrase. */
export async function encryptMnemonic(mnemonic: string): Promise<VaultBlob> {
  const normalized = normPhrase(mnemonic);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKeyFromPhrase(normalized, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    enc.encode(normalized),
  );
  return {
    v: 2,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(ciphertext)),
  };
}

/** Decrypt vault using the recovery phrase the user typed (only login factor). */
export async function decryptMnemonic(
  blob: VaultBlob,
  phraseInput: string,
): Promise<string> {
  const normalized = normPhrase(phraseInput);
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const ciphertext = fromB64(blob.ciphertext);
  const key = await deriveAesKeyFromPhrase(normalized, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext),
  );
  return new TextDecoder().decode(plain);
}
