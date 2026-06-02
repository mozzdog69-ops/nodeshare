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
  const owner = new URL(req.url).searchParams.get("owner")?.trim() ?? "";
  if (!isAkashAddr(owner)) {
    return NextResponse.json(
      { ok: false, error: "Invalid akash1… address", data: null },
      { status: 400 },
    );
  }

  const bases = (
    process.env.AKASH_LCD_URL
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  for (const base of bases) {
    const url = `${base}/akash/provider/v1beta4/providers/${owner}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        provider?: { host_uri?: string; hostUri?: string };
      };
      const uri = String(json.provider?.host_uri ?? json.provider?.hostUri ?? "").trim();
      return NextResponse.json({
        ok: true,
        data: { owner, hostUri: uri || null, hasHostUri: uri.length > 4 },
      });
    } catch {
      /* try next */
    }
  }

  return NextResponse.json(
    { ok: false, error: "Could not load provider from Akash LCD.", data: { hasHostUri: false } },
    { status: 502 },
  );
}
