import { fetchLiveAktUsd, getAktUsdEstimate } from "@/lib/akash/akt-price";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const usd = await fetchLiveAktUsd();
    return NextResponse.json({
      ok: true,
      data: { usd, source: "coingecko" },
    });
  } catch {
    const fallback = getAktUsdEstimate();
    return NextResponse.json({
      ok: true,
      data: { usd: fallback, source: "fallback" },
    });
  }
}
