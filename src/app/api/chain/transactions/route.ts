import { NextResponse } from "next/server";
import { getChainId, getUsdcAddress, getUsdtAddress } from "@/lib/chain/config";
import { normalizeHexAddress } from "@/lib/chain/normalize-address";

export const dynamic = "force-dynamic";

type EtherscanTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  contractAddress: string;
  value: string;
  tokenDecimal: string;
  tokenSymbol: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address") ?? "";
  const key = process.env.ETHERSCAN_API_KEY;
  const chainId = getChainId();

  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error: "ETHERSCAN_API_KEY is not set (needed for token transfer history)",
        data: { transfers: [] as unknown[] },
      },
      { status: 503 },
    );
  }

  let address: string;
  try {
    address = normalizeHexAddress(raw.trim());
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing address", data: null },
      { status: 400 },
    );
  }

  const apiKey = key;
  const usdc = getUsdcAddress().toLowerCase();
  const usdt = getUsdtAddress().toLowerCase();

  async function tryV2(): Promise<EtherscanTx[] | null> {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", address);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "40");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    const json = (await res.json()) as {
      status: string;
      message: string;
      result: EtherscanTx[] | string;
    };
    if (json.status === "1" && Array.isArray(json.result)) return json.result;
    return null;
  }

  async function tryV1Mainnet(): Promise<EtherscanTx[] | null> {
    if (chainId !== 1) return null;
    const url = new URL("https://api.etherscan.io/api");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", address);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "40");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", apiKey);
    const res = await fetch(url.toString(), { next: { revalidate: 30 } });
    const json = (await res.json()) as {
      status: string;
      message: string;
      result: EtherscanTx[] | string;
    };
    if (json.status === "1" && Array.isArray(json.result)) return json.result;
    return null;
  }

  try {
    const list = (await tryV2()) ?? (await tryV1Mainnet());
    if (!list) {
      return NextResponse.json({
        ok: false,
        error: "Etherscan did not return token transfers (check API key / chain)",
        data: { transfers: [] },
      });
    }

    const filtered = list.filter((t) => {
      const c = t.contractAddress?.toLowerCase();
      return c === usdc || c === usdt;
    });

    const transfers = filtered.map((t) => ({
      hash: t.hash,
      timestamp: Number(t.timeStamp) * 1000,
      from: t.from,
      to: t.to,
      symbol: t.tokenSymbol,
      value: t.value,
      decimals: Number(t.tokenDecimal) || 6,
      contractAddress: t.contractAddress,
    }));

    return NextResponse.json({ ok: true, data: { transfers } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: msg, data: { transfers: [] } },
      { status: 500 },
    );
  }
}
