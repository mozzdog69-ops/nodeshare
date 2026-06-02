import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public hint for UI — no secrets. True when server can proxy to a GPU provisioning API. */
export async function GET() {
  const url = String(process.env.GPU_BACKEND_URL || "").trim();
  return NextResponse.json({
    ok: true,
    configured: Boolean(url),
  });
}
