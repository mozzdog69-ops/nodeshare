import { fetchConsoleProvidersByOwner } from "@/lib/akash/fetch-console-providers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { providersByOwner, providerMetaByOwner, source, error } = await fetchConsoleProvidersByOwner();
  if (error) {
    return NextResponse.json(
      { ok: false, error, data: { providersByOwner: {}, providerMetaByOwner: {} } },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    data: {
      source,
      providerCount: Object.keys(providersByOwner).length,
      providersByOwner,
      providerMetaByOwner,
    },
  });
}
