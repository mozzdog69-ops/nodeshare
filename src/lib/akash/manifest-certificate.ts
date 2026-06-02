import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { certificateManager } from "@akashnetwork/chain-sdk/provider";

/** PEM compatible with Akash provider mTLS (chain-sdk CertificateManager). */
export async function generateProviderCertificatePem(owner: string): Promise<AkashCertificatePem> {
  const pem = await certificateManager.generatePEM(owner);
  return {
    cert: pem.cert,
    publicKey: pem.publicKey,
    privateKey: pem.privateKey,
  };
}
