import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function tryOrdersJson(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const orders = o.orders ?? o.order;
  return Array.isArray(orders) ? orders : [];
}

async function fetchOrdersFrom(
  baseRaw: string,
  apiVer: "v1beta4" | "v1beta3",
  limit: number,
): Promise<
  | { ok: true; orders: unknown[]; source: string }
  | { ok: false; source: string; status?: number; err?: string }
> {
  const base = baseRaw.replace(/\/$/, "");
  const path = `/akash/market/${apiVer}/orders?pagination.limit=${limit}`;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      headers: AKASH_FETCH_HEADERS,
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, source: url, status: res.status };
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, source: url, err: "invalid JSON body" };
    }
    const orders = tryOrdersJson(json);
    return { ok: true, orders, source: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, source: url, err: msg };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    40,
    Math.max(5, parseInt(searchParams.get("limit") ?? "15", 10) || 15),
  );

  const bases = (
    process.env.AKASH_LCD_URL
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  const attempts: string[] = [];

  for (const ver of ["v1beta4", "v1beta3"] as const) {
    for (const base of bases) {
      const got = await fetchOrdersFrom(base, ver, limit);
      if (got.ok) {
        return NextResponse.json({
          ok: true,
          data: {
            source: got.source,
            orders: got.orders,
          },
        });
      }
      const bit =
        got.status !== undefined
          ? `${got.source} → HTTP ${got.status}`
          : `${got.source} → ${got.err ?? "failed"}`;
      attempts.push(bit);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "No Akash LCD returned valid market orders. Override with AKASH_LCD_URL (REST base from chain-registry REST list).",
      data: { orders: [], attempts: attempts.slice(-15) },
    },
    { status: 502 },
  );
}
