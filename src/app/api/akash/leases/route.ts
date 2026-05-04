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

function tryLeasesJson(json: unknown): unknown[] {
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  const leases = o.leases ?? o.lease;
  return Array.isArray(leases) ? leases : [];
}

const LEASE_API_VERSIONS = ["v1beta5", "v1beta4", "v1beta3"] as const;

async function fetchLeasesFrom(
  baseRaw: string,
  apiVer: (typeof LEASE_API_VERSIONS)[number],
  owner: string,
  limit: number,
): Promise<
  | { ok: true; leases: unknown[]; source: string }
  | { ok: false; source: string; status?: number; err?: string }
> {
  const base = baseRaw.replace(/\/$/, "");
  const qs = new URLSearchParams({
    "pagination.limit": String(limit),
    "filters.owner": owner,
  });
  const path = `/akash/market/${apiVer}/leases/list?${qs.toString()}`;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      headers: AKASH_FETCH_HEADERS,
      cache: "no-store",
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
    const leases = tryLeasesJson(json);
    return { ok: true, leases, source: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, source: url, err: msg };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("address") ?? "").trim();
  const limit = Math.min(
    40,
    Math.max(3, parseInt(searchParams.get("limit") ?? "20", 10) || 20),
  );

  if (!isAkashAddr(raw)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing akash1… address", data: { leases: [] } },
      { status: 400 },
    );
  }

  const bases = (
    process.env.AKASH_LCD_URL
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  const attempts: string[] = [];

  for (const ver of LEASE_API_VERSIONS) {
    for (const base of bases) {
      const got = await fetchLeasesFrom(base, ver, raw, limit);
      if (got.ok) {
        return NextResponse.json({
          ok: true,
          data: {
            source: got.source,
            leases: got.leases,
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
        "No Akash LCD returned leases for this owner. Set AKASH_LCD_URL=https://api.akashnet.net if needed.",
      data: { leases: [], attempts: attempts.slice(-15) },
    },
    { status: 502 },
  );
}
