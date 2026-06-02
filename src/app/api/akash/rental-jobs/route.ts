import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { fetchAkashRentalJobsFromLcd } from "@/lib/akash/fetch-akash-rental-jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const owner = sanitizeAkashAddress(new URL(req.url).searchParams.get("owner"));
  if (!owner) {
    return NextResponse.json({ ok: false, error: "owner (akash1…) is required" }, { status: 400 });
  }

  try {
    const items = await fetchAkashRentalJobsFromLcd(owner);
    return NextResponse.json({ ok: true, items, source: "akash-lcd" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load on-chain rentals";
    return NextResponse.json({ ok: false, error: msg, items: [] }, { status: 502 });
  }
}
