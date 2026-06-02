import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { createChainNodeSDK } from "@akashnetwork/chain-sdk/chain/web";
import { createAkashStargateClient } from "@/lib/akash/akash-stargate-client";
import { getAkashLcdUrl, getAkashRpcUrl } from "@/lib/akash/chain-config";

export type AkashChainSdk = ReturnType<typeof createChainNodeSDK>;

export async function createAkashSdkFromMnemonic(mnemonic: string): Promise<{
  sdk: AkashChainSdk;
  address: string;
  wallet: DirectSecp256k1HdWallet;
}> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), { prefix: "akash" });
  const [account] = await wallet.getAccounts();
  const signer = createAkashStargateClient({
    baseUrl: getAkashRpcUrl(),
    signer: wallet,
  });
  const sdk = createChainNodeSDK({
    query: { baseUrl: getAkashLcdUrl() },
    tx: { signer },
  });
  return { sdk, address: account.address, wallet };
}
