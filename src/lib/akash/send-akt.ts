import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { getAkashChainId, getAkashRpcUrl, UAKT_PER_AKT } from "@/lib/akash/chain-config";

function aktToUaktString(amountAkt: string): string {
  const parts = amountAkt.trim().split(".");
  const whole = parts[0]?.replace(/\D/g, "") || "0";
  const frac = (parts[1] || "").padEnd(6, "0").slice(0, 6);
  const uakt = BigInt(whole) * BigInt(UAKT_PER_AKT) + BigInt(frac);
  if (uakt <= BigInt(0)) throw new Error("AKT amount must be greater than zero.");
  return uakt.toString();
}

export async function sendAktFromMnemonic(input: {
  mnemonic: string;
  to: string;
  amountAkt: string;
}): Promise<{ hash: string; confirmedOnchain: boolean }> {
  const to = input.to.trim();
  if (!/^akash1[a-z0-9]{38}$/.test(to)) {
    throw new Error("Invalid Akash treasury address.");
  }

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(input.mnemonic.trim(), {
    prefix: "akash",
  });
  const [account] = await wallet.getAccounts();
  const rpc = getAkashRpcUrl();
  const client = await SigningStargateClient.connectWithSigner(rpc, wallet, {
    gasPrice: GasPrice.fromString("0.025uakt"),
  });

  const uaktAmount = aktToUaktString(input.amountAkt);
  const result = await client.sendTokens(
    account.address,
    to,
    [{ denom: "uakt", amount: uaktAmount }],
    {
      amount: [{ denom: "uakt", amount: "5000" }],
      gas: "200000",
    },
    `NodeShare GPU checkout · ${getAkashChainId()}`,
  );

  await client.disconnect?.();

  return {
    hash: result.transactionHash,
    confirmedOnchain: result.code === 0,
  };
}
