import type { TxClient } from "@akashnetwork/chain-sdk/chain/web";
import { MSG_MINT_ACT_TYPE_URL } from "@/lib/akash/bme-messages";
import { getAkashRpcUrl } from "@/lib/akash/chain-config";
import { createAkashStargateClient } from "@/lib/akash/akash-stargate-client";
import { createAkashSdkFromMnemonic } from "@/lib/akash/akash-sdk-client";

export async function mintActFromAkt(input: {
  mnemonic: string;
  owner: string;
  burnUakt: string;
}): Promise<string> {
  const burnUakt = String(input.burnUakt || "").trim();
  if (!/^\d+$/.test(burnUakt) || burnUakt === "0") {
    throw new Error("Invalid AKT amount for ACT conversion.");
  }

  const { wallet } = await createAkashSdkFromMnemonic(input.mnemonic);
  const signer: TxClient = createAkashStargateClient({
    baseUrl: getAkashRpcUrl(),
    signer: wallet,
  });

  const msg = {
    typeUrl: MSG_MINT_ACT_TYPE_URL,
    value: {
      owner: input.owner,
      to: input.owner,
      coinsToBurn: { denom: "uakt", amount: burnUakt },
    },
  };

  const memo = "NodeShare · mint ACT for GPU escrow";
  const fee = await signer.estimateFee([msg], memo);
  const txRaw = await signer.sign([msg], fee, memo);
  const res = await signer.broadcast(txRaw);
  if (res.code !== 0) {
    throw new Error(`ACT mint failed (code ${res.code}): ${res.rawLog || "unknown"}`);
  }
  return res.transactionHash;
}
