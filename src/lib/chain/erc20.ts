import { Contract, JsonRpcProvider, formatUnits } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

export async function readErc20Balance(
  rpcUrl: string,
  tokenAddress: string,
  holderAddress: string,
): Promise<{ raw: bigint; decimals: number; formatted: string }> {
  const provider = new JsonRpcProvider(rpcUrl);
  const c = new Contract(tokenAddress, ERC20_ABI, provider);
  const [raw, decRaw] = await Promise.all([
    c.balanceOf(holderAddress) as Promise<bigint>,
    c.decimals() as Promise<bigint | number>,
  ]);
  const decimals = Number(decRaw);
  return {
    raw,
    decimals,
    formatted: formatUnits(raw, decimals),
  };
}

export async function readNativeBalance(
  rpcUrl: string,
  address: string,
): Promise<{ wei: bigint; formatted: string }> {
  const provider = new JsonRpcProvider(rpcUrl);
  const wei = await provider.getBalance(address);
  return { wei, formatted: formatUnits(wei, 18) };
}
