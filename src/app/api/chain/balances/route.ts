import { NextResponse } from "next/server";
import { getChainId, getUsdcAddress, getUsdtAddress } from "@/lib/chain/config";
import { readErc20Balance, readNativeBalance } from "@/lib/chain/erc20";
import { normalizeHexAddress } from "@/lib/chain/normalize-address";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address") ?? "";
  const rpc = process.env.ETH_RPC_URL?.trim();

  if (!rpc) {
    return NextResponse.json(
      {
        ok: false,
        error: "ETH_RPC_URL is not set (server-side JSON-RPC for balances)",
        data: null,
      },
      { status: 503 },
    );
  }

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
      { ok: false, error: msg, data: null },
      { status: 502 },
    );
  }
}
