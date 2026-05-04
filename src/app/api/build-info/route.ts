import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Verify you hit the right deployment. On Vercel, `git` is the commit SHA.
 * Open: https://YOUR_VERCEL_URL/api/build-info
 */
export async function GET() {
  return NextResponse.json({
    git: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    hasStaticExport:
      process.env.STATIC_IPFS_EXPORT === "1" ? "yes (unusual on Vercel)" : "no",
  });
}
