import {
  AKASH_FETCH_HEADERS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FETCH_OPTS: RequestInit = {
  headers: AKASH_FETCH_HEADERS,
  next: { revalidate: 15 },
};

function tryOrdersJson(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const orders = o.orders ?? o.order;
  return Array.isArray(orders) ? orders : [];
}

/** Try one GET; returns orders + url on 200 + parseable body. */
async function fetchOrdersFrom(
  base: string,
  apiVer: "v1beta4" | "v1beta3",
  limit: number,
): Promise<{ orders: unknown[]; source: string } | null> {
  const path = `/akash/market/${apiVer}/orders?pagination.limit=${limit}`;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, FETCH_OPTS);
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const orders = tryOrdersJson(json);
    return { orders, source: url };
  } catch {
    return null;
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

  /**
   * Prefer v1beta4 everywhere first (publicnode-style mirrors often 501 on beta3).
   * Then retry all bases with v1beta3.
   */
  for (const ver of ["v1beta4", "v1beta3"] as const) {
    for (const base of bases) {
      const got = await fetchOrdersFrom(base, ver, limit);
      if (got) {
        return NextResponse.json({
          ok: true,
          data: {
            source: got.source,
            orders: got.orders,
          },
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "No Akash LCD returned market orders (tried v1beta4 then v1beta3 on multiple REST nodes). Set AKASH_LCD_URL to a REST base you trust.",
      data: { orders: [] },
    },
    { status: 502 },
  );
}
