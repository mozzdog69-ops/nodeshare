import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { createProviderManifestJwt } from "@/lib/akash/akash-provider-auth";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export type CreateProviderShellJwtInput = {
  mnemonic: string;
  iss: string;
  provider: string;
  dseq: number;
};

/** JWT with shell + status scopes for provider lease terminal. */
export async function createProviderShellJwtServer(
  input: CreateProviderShellJwtInput,
): Promise<string> {
  const mnemonic = input.mnemonic.trim();
  if (!mnemonic) throw new Error("Wallet mnemonic is required for provider shell JWT.");

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "akash" });
  const [account] = await wallet.getAccounts();
  const iss = sanitizeAkashAddress(input.iss) || sanitizeAkashAddress(account.address);
  const provider = sanitizeAkashAddress(input.provider);
  if (!iss || !provider) {
    throw new Error("Valid Akash owner and provider addresses are required for shell JWT.");
  }

  return createProviderManifestJwt(wallet, mnemonic, {
    iss,
    provider,
    dseq: input.dseq,
    scope: ["status", "logs", "shell"],
  });
}
