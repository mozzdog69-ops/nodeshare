import type { AkashChainSdk } from "@/lib/akash/akash-sdk-client";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { generateProviderCertificatePem } from "@/lib/akash/manifest-certificate";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export { generateProviderCertificatePem };

async function waitForCertIndexed(sdk: AkashChainSdk, owner: string, rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    const res = await sdk.akash.cert.v1.getCertificates({
      filter: { owner, state: "valid", serial: "" },
    });
    if (res.certificates?.length) return;
    await sleep(3000);
  }
}

/**
 * Publish client certificate on Akash for mTLS manifest upload.
 * Reuses browser-stored PEM when present; otherwise creates one chain-sdk PEM.
 */
export async function publishManifestCertificate(
  sdk: AkashChainSdk,
  owner: string,
  existing?: AkashCertificatePem | null,
): Promise<AkashCertificatePem> {
  if (existing?.cert && existing.privateKey) {
    return existing;
  }

  const onChain = await sdk.akash.cert.v1.getCertificates({
    filter: { owner, state: "valid", serial: "" },
  });
  if (onChain.certificates?.length && existing?.cert && existing.privateKey) {
    return existing;
  }

  const pem = await generateProviderCertificatePem(owner);
  await sdk.akash.cert.v1.createCertificate({
    owner,
    cert: new TextEncoder().encode(pem.cert),
    pubkey: new TextEncoder().encode(pem.publicKey),
  });
  await waitForCertIndexed(sdk, owner);
  return pem;
}
