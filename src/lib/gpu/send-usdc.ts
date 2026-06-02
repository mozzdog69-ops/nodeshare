import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { getUsdcAddress } from "@/lib/chain/config";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;

export async function sendUsdcFromMnemonic(input: {
  mnemonic: string;
  to: string;
  amount: string;
}): Promise<{ hash: string; confirmedOnchain: boolean }> {
  const rpc = process.env.NEXT_PUBLIC_ETH_RPC_URL;
  if (!rpc) throw new Error("Set NEXT_PUBLIC_ETH_RPC_URL for USDC payments.");

  const provider = new JsonRpcProvider(rpc);
  const wallet = Wallet.fromPhrase(input.mnemonic.trim()).connect(provider);
  const contract = new Contract(getUsdcAddress(), ERC20_ABI, wallet);
  const decimals = Number(await contract.decimals());
  const tx = await contract.transfer(input.to.trim(), parseUnits(input.amount.trim(), decimals));
  const receipt = await tx.wait(1);
  return {
    hash: String(tx.hash),
    confirmedOnchain: receipt?.status === 1,
  };
}

export function getGpuUsdcTreasury(): string {
  const a = String(
    process.env.NEXT_PUBLIC_GPU_TREASURY_ADDRESS ||
      process.env.NEXT_PUBLIC_TREASURY_WALLET ||
      "",
  ).trim();
  if (a && /^0x[a-fA-F0-9]{40}$/.test(a)) return a;
  throw new Error(
    "Set NEXT_PUBLIC_GPU_TREASURY_ADDRESS to the treasury wallet that receives GPU checkout USDC.",
  );
}
