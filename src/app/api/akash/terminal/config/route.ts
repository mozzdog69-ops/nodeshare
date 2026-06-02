import { resolveProxyWsFromEnv } from "@/lib/akash/akash-provider-proxy-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Runtime proxy URL for GPU shell (ignores stale localhost env on production). */
export async function GET(req: Request) {
  const raw = String(
    process.env.AKASH_PROVIDER_PROXY_WS ||
      process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS ||
      "",
  ).trim();
  const siteHost = new URL(req.url).hostname;
  const proxyWs = resolveProxyWsFromEnv(raw, siteHost);
  return NextResponse.json({
    ok: true,
    proxyWs,
  });
}
