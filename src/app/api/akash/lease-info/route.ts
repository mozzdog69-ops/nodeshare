import { fetchManifestRetryEligibility } from "@/lib/akash/fetch-lease-info";
import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = sanitizeAkashAddress(url.searchParams.get("owner"));
  const dseq = Math.floor(Number(url.searchParams.get("dseq") ?? 0));

  if (!owner || !dseq) {
    return NextResponse.json({ ok: false, error: "owner and dseq are required" }, { status: 400 });
  }

  const { lease, canRetryManifest, retryBlockedReason } = await fetchManifestRetryEligibility(
    owner,
    dseq,
  );

  return NextResponse.json({
    ok: true,
    lease,
    canRetryManifest,
    retryBlockedReason: retryBlockedReason ?? null,
  });
}
