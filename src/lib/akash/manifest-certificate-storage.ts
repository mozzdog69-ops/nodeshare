import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";

const PREFIX = "nodeshare_akash_cert_";

export function saveManifestCertificatePem(address: string, pem: AkashCertificatePem) {
  if (!address || typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${address.toLowerCase()}`, JSON.stringify(pem));
  } catch {
    /* ignore */
  }
}

export function readManifestCertificatePem(address: string): AkashCertificatePem | null {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${address.toLowerCase()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AkashCertificatePem;
    if (!parsed?.cert || !parsed?.privateKey) return null;
    return parsed;
  } catch {
    return null;
  }
}
