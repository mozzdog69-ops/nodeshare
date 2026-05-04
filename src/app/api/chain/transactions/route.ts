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

type EtherscanJson = {
  status: string;
  message: string;
  result: EtherscanTx[] | string;
};

async function fetchTokentx(url: URL): Promise<EtherscanTx[] | null> {
  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  const json = (await res.json()) as EtherscanJson;

  if (json.status === "1" && Array.isArray(json.result)) {
    return json.result;
  }

  if (
    json.status === "0" &&
    typeof json.result === "string" &&
    (json.result.toLowerCase().includes("no transactions") ||
      json.result.toLowerCase().includes("no record") ||
      json.message?.toLowerCase().includes("no transactions"))
  ) {
    return [];
  }

  if (json.status === "1" && json.result === "") {
    return [];
  }

  return null;
}

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

  /** Etherscan accepts lowercase hex for tokentx. */
  const addrParam = address.toLowerCase();

  const apiKey = key;
  const usdc = getUsdcAddress().toLowerCase();
  const usdt = getUsdtAddress().toLowerCase();

  /** Classic v1 API — most reliable for Ethereum mainnet ERC-20 history. */
  async function tryV1Mainnet(): Promise<EtherscanTx[] | null> {
    if (chainId !== 1) return null;
    const url = new URL("https://api.etherscan.io/api");
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", addrParam);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "40");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", apiKey);
    return fetchTokentx(url);
  }

  /** Multi-chain v2 — try after v1 when chain id is supported by your key. */
  async function tryV2(): Promise<EtherscanTx[] | null> {
    const url = new URL("https://api.etherscan.io/v2/api");
    url.searchParams.set("chainid", String(chainId));
    url.searchParams.set("module", "account");
    url.searchParams.set("action", "tokentx");
    url.searchParams.set("address", addrParam);
    url.searchParams.set("page", "1");
    url.searchParams.set("offset", "40");
    url.searchParams.set("sort", "desc");
    url.searchParams.set("apikey", apiKey);
    return fetchTokentx(url);
  }

  try {
    const list = (await tryV1Mainnet()) ?? (await tryV2());

    if (!list) {
      return NextResponse.json({
        ok: false,
        error:
          "Etherscan did not return token transfers (check API key / chain). Ensure your key allows Ethereum mainnet API Pro / V2 if using chainid≠1.",
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
