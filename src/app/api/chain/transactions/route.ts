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

function parseTokentx(json: EtherscanJson):
  | { ok: true; rows: EtherscanTx[] }
  | { ok: false; detail: string } {
  if (json.status === "1") {
    if (Array.isArray(json.result)) {
      return { ok: true, rows: json.result };
    }
    if (json.result === "") {
      return { ok: true, rows: [] };
    }
  }

  const r = json.result;
  const combined = `${json.message ?? ""} ${typeof r === "string" ? r : ""}`.toLowerCase();
  if (
    json.status === "0" &&
    /no transactions|no records|no token/i.test(combined)
  ) {
    return { ok: true, rows: [] };
  }

  const detail =
    typeof r === "string" && r.length > 0
      ? `${json.message ?? "NOTOK"}: ${r}`
      : json.message || "Unexpected Etherscan response";
  return { ok: false, detail };
}

/** Etherscan deprecated legacy V1 — use unified V2 only (see docs.etherscan.io/v2-migration). */
async function fetchTokentxV2(
  apiKey: string,
  chainId: number,
  addrParam: string,
): Promise<{ ok: true; rows: EtherscanTx[] } | { ok: false; detail: string }> {
  const url = new URL("https://api.etherscan.io/v2/api");
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", addrParam);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "40");
  url.searchParams.set("startblock", "0");
  url.searchParams.set("endblock", "99999999");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), {
    next: { revalidate: 30 },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return { ok: false, detail: `HTTP ${res.status} from Etherscan V2` };
  }
  const json = (await res.json()) as EtherscanJson;
  return parseTokentx(json);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address") ?? "";
  const apiKey = process.env.ETHERSCAN_API_KEY?.trim() ?? "";
  const chainId = getChainId();

  if (!apiKey || apiKey === "YOUR_ETHERSCAN_KEY") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "ETHERSCAN_API_KEY missing — create a key at etherscan.io/myapikey (unified V2). Paste into Netlify with no quotes/spaces, then redeploy.",
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

  const addrParam = address.toLowerCase();
  const usdc = getUsdcAddress().toLowerCase();
  const usdt = getUsdtAddress().toLowerCase();

  try {
    const parsed = await fetchTokentxV2(apiKey, chainId, addrParam);

    if (!parsed.ok) {
      const hint =
        /invalid api key|#err2/i.test(parsed.detail)
          ? " Regenerate your API key on Etherscan (API Dashboard → create new key); legacy keys may not work with V2."
          : "";
      return NextResponse.json({
        ok: false,
        error: `Etherscan V2: ${parsed.detail}.${hint}`,
        data: { transfers: [] },
      });
    }

    const filtered = parsed.rows.filter((t) => {
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
