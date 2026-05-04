import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Wallet } from "ethers";

export type NodeIdentity = {
  mnemonic: string;
  ethAddress: string;
  aktAddress: string;
};

function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

/**
 * Client-only: creates a fresh ETH + Akash (AKT) identity from one BIP39 mnemonic.
 * Persist only via encrypted vault — never plaintext on disk.
 */
export async function generateNodeIdentity(): Promise<NodeIdentity> {
  const eth = Wallet.createRandom();
  const phrase = eth.mnemonic!.phrase;
  return deriveIdentityFromMnemonic(phrase);
}

/**
 * Restores ETH + Akash addresses from an existing BIP39 phrase (12 or 24 words).
 * Throws if the phrase is invalid.
 */
export async function deriveIdentityFromMnemonic(
  phrase: string,
): Promise<NodeIdentity> {
  const normalized = normalizeMnemonic(phrase);
  const eth = Wallet.fromPhrase(normalized);
  const canonical = eth.mnemonic?.phrase ?? normalized;

  const aktWallet = await DirectSecp256k1HdWallet.fromMnemonic(canonical, {
    prefix: "akash",
  });
  const [aktAccount] = await aktWallet.getAccounts();

  return {
    mnemonic: canonical,
    ethAddress: eth.address,
    aktAddress: aktAccount.address,
  };
}
