import { Wallet } from "ethers";
import type { NodeIdentity } from "@/lib/wallet/node-identity";
import type { GpuSigningWallet } from "@/lib/gpu/types";

export function signingWalletFromIdentity(identity: NodeIdentity): GpuSigningWallet {
  const wallet = Wallet.fromPhrase(identity.mnemonic.trim());
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}
