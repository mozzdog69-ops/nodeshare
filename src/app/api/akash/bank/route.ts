import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isAkashAddr(a: string) {
  return /^akash1[a-z0-9]{38}$/.test(a);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") ?? "").trim();
  const bases = (
    process.env.AKASH_LCD_URL
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  if (!isAkashAddr(address)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid akash1… address",
        data: null,
      },
      { status: 400 },
    );
  }

  let lastErr = "No LCD reachable";

  for (const base of bases) {
    const url = `${base}/cosmos/bank/v1beta1/balances/${address}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastErr = `${base} → ${res.status}`;
        continue;
      }
      const json = (await res.json()) as {
        balances?: { denom: string; amount: string }[];
      };
      const balances = json.balances ?? [];
      const uakt = balances.find((b) => b.denom === "uakt");
      const raw = uakt?.amount ?? "0";
      const akt = Number(raw) / 1_000_000;
      return NextResponse.json({
        ok: true,
        data: {
          source: url,
          denom: "AKT",
          uakt: raw,
          aktFormatted: Number.isFinite(akt)
            ? akt.toLocaleString(undefined, { maximumFractionDigits: 6 })
            : raw,
        },
      });
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: `${lastErr} — set AKASH_LCD_URL to a working REST node from the Akash chain-registry REST list.`,
      data: null,
    },
    { status: 502 },
  );
}
