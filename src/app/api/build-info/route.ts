import { NextResponse } from "next/server";
import { validateEthRpcUrl } from "@/lib/chain/rpc-url";

export const dynamic = "force-dynamic";

/**
 * Verify you hit the right deployment. On Vercel, `git` is the commit SHA.
 * Open: https://YOUR_SITE/api/build-info
 */
export async function GET() {
  const rpc = validateEthRpcUrl(process.env.ETH_RPC_URL);
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
    env: {
      ethRpcUrl: rpc.ok ? "configured" : rpc.error,
      ethRpcPublic: process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim()
        ? "configured"
        : "missing",
      etherscan: process.env.ETHERSCAN_API_KEY?.trim() ? "configured" : "missing",
      akashLcd: process.env.AKASH_LCD_URL?.trim() || "default (api.akashnet.net)",
    },
  });
}
