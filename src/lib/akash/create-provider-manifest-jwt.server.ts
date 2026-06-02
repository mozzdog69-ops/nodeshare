import { createProviderManifestJwt } from "@/lib/akash/akash-provider-auth";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export type CreateProviderManifestJwtInput = {
  mnemonic: string;
  iss: string;
  provider: string;
  dseq: number;
};

/** Build provider JWT (ES256K + AEP-64 claims) with explicit mnemonic signing. */
export async function createProviderManifestJwtServer(
  input: CreateProviderManifestJwtInput,
): Promise<string> {
  const mnemonic = input.mnemonic.trim();
  if (!mnemonic) throw new Error("Wallet mnemonic is required to sign the provider JWT.");

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "akash" });
  const [account] = await wallet.getAccounts();
  const iss = sanitizeAkashAddress(input.iss) || sanitizeAkashAddress(account.address);
  const provider = sanitizeAkashAddress(input.provider);
  if (!iss || !provider) {
    throw new Error("Valid Akash owner and provider addresses are required for manifest JWT.");
  }
  if (iss !== sanitizeAkashAddress(account.address)) {
    throw new Error("Manifest JWT owner must match your unlocked wallet address.");
  }

  return createProviderManifestJwt(wallet, mnemonic, {
    iss,
    provider,
    dseq: input.dseq,
  });
}
