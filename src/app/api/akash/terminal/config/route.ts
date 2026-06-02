import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Normalize proxy URL for browser WebSocket (https→wss). */
function normalizeProxyWsUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return `wss://${trimmed.slice(8)}`;
  if (trimmed.startsWith("http://")) return `ws://${trimmed.slice(7)}`;
  if (trimmed.startsWith("wss://") || trimmed.startsWith("ws://")) return trimmed;
  return `wss://${trimmed}`;
}

/** Runtime proxy URL (works without rebuild if AKASH_PROVIDER_PROXY_WS is set on Netlify). */
export async function GET() {
  const raw = String(
    process.env.AKASH_PROVIDER_PROXY_WS ||
      process.env.NEXT_PUBLIC_AKASH_PROVIDER_PROXY_WS ||
      "",
  ).trim();
  const proxyWs = normalizeProxyWsUrl(raw);
  return NextResponse.json({
    ok: true,
    proxyWs: proxyWs || null,
  });
}
