import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Prefer REST endpoints that implement market v1beta4; publicnode often 501 on beta3. */
const DEFAULT_LCDS = [
  "https://rest.akashnet.net",
  "https://akash-api.lavenderfive.com:443",
  "https://akash-rest.publicnode.com",
];

const FETCH_OPTS: RequestInit = {
  headers: {
    Accept: "application/json",
    "User-Agent": "NodeShare/1.0 (+https://github.com/mozzdog69-ops/nodeshare)",
  },
  next: { revalidate: 15 },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    40,
    Math.max(5, parseInt(searchParams.get("limit") ?? "15", 10) || 15),
  );

  const bases = (
    process.env.AKASH_LCD_URL ? [process.env.AKASH_LCD_URL] : DEFAULT_LCDS
  ).map((b) => b.replace(/\/$/, ""));

  /** Prefer v1beta4 (newer LCDs); fall back to v1beta3 only if needed. */
  const paths = [
    `/akash/market/v1beta4/orders?pagination.limit=${limit}`,
    `/akash/market/v1beta3/orders?pagination.limit=${limit}`,
  ];

  let lastErr = "No LCD reachable";

  for (const base of bases) {
    for (const path of paths) {
      try {
        const url = `${base}${path}`;
        const res = await fetch(url, FETCH_OPTS);
        if (!res.ok) {
          lastErr = `${url} → ${res.status}`;
          continue;
        }
        const json = (await res.json()) as {
          orders?: unknown[];
          pagination?: { next_key?: string };
        };
        const orders = json.orders ?? (json as { order?: unknown[] }).order ?? [];
        return NextResponse.json({
          ok: true,
          data: {
            source: url,
            orders: Array.isArray(orders) ? orders : [],
          },
        });
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }

  return NextResponse.json(
    { ok: false, error: lastErr, data: { orders: [] } },
    { status: 502 },
  );
}
