import { NextResponse } from "next/server";
import {
  probeEthRpc,
  resolveEthRpcUrl,
  validateEthRpcUrl,
} from "@/lib/chain/rpc-url";

export const dynamic = "force-dynamic";

/**
 * Verify you hit the right deployment. On Vercel, `git` is the commit SHA.
 * Open: https://YOUR_SITE/api/build-info
 */
export async function GET() {
  const resolved = resolveEthRpcUrl();
  const rpc = validateEthRpcUrl(resolved.raw);
  const probe = rpc.ok ? await probeEthRpc(rpc.url) : null;

  return NextResponse.json({
    git:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.COMMIT_REF ??
      process.env.NETLIFY_COMMIT_REF ??
      null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    netlify: process.env.NETLIFY === "true" ? true : null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.DEPLOY_ID ?? null,
    hasStaticExport:
      process.env.STATIC_IPFS_EXPORT === "1" ? "yes (unusual on Vercel)" : "no",
    apiBase: process.env.NEXT_PUBLIC_API_BASE?.trim()
      ? "set (static/IPFS calls this origin for /api)"
      : "unset (same-origin /api)",
    env: {
      ethRpcSource: resolved.source ?? "none",
      ethRpcUrl: rpc.ok ? "configured" : rpc.error,
      ethRpcProbe: probe
        ? probe.ok
          ? { ok: true, chainId: probe.chainId }
          : { ok: false, detail: probe.detail, status: probe.status }
        : null,
      ethRpcPublic: process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim()
        ? "configured"
        : "missing",
      ethRpcServerOnly: process.env.ETH_RPC_URL?.trim() ? "configured" : "missing",
      etherscan: process.env.ETHERSCAN_API_KEY?.trim() ? "configured" : "missing",
      akashLcd: process.env.AKASH_LCD_URL?.trim() || "default (api.akashnet.net)",
    },
  });
}
