import { NextResponse } from "next/server";
import { getChainId, getUsdcAddress, getUsdtAddress } from "@/lib/chain/config";
import { readErc20Balance, readNativeBalance } from "@/lib/chain/erc20";
import { normalizeHexAddress } from "@/lib/chain/normalize-address";
import { friendlyRpcError, validateEthRpcUrl } from "@/lib/chain/rpc-url";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address") ?? "";
  const rpcCheck = validateEthRpcUrl(process.env.ETH_RPC_URL);
  if (!rpcCheck.ok) {
    return NextResponse.json(
      { ok: false, error: rpcCheck.error, data: null },
      { status: 503 },
    );
  }
  const rpc = rpcCheck.url;

  let address: string;
  try {
    address = normalizeHexAddress(raw.trim());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing address query param", data: null },
      { status: 400 },
    );
  }

  const chainId = getChainId();
  const usdc = getUsdcAddress();
  const usdt = getUsdtAddress();

  try {
    const [eth, usdcBal, usdtBal] = await Promise.all([
      readNativeBalance(rpc, address),
      readErc20Balance(rpc, usdc, address),
      readErc20Balance(rpc, usdt, address),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        chainId,
        address,
        native: { symbol: "ETH", balance: eth.formatted },
        usdc: { contract: usdc, balance: usdcBal.formatted },
        usdt: { contract: usdt, balance: usdtBal.formatted },
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "RPC error";
    return NextResponse.json(
      { ok: false, error: friendlyRpcError(msg), data: null },
      { status: 502 },
    );
  }
}
