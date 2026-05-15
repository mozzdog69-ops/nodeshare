/**
 * Runs once per server process (Node). Logs production gaps without crashing deploys.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (!isProd) return;

  const required = ["ETHERSCAN_API_KEY", "NEXT_PUBLIC_APP_URL"] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    console.warn(
      "[NodeShare] Production missing env (on-chain live features degraded):",
      missing.join(", "),
    );
  }
  const hasRpc =
    process.env.ETH_RPC_URL?.trim() || process.env.NEXT_PUBLIC_ETH_RPC_URL?.trim();
  if (!hasRpc) {
    console.warn(
      "[NodeShare] No ETH_RPC_URL or NEXT_PUBLIC_ETH_RPC_URL — balances and sends will fail.",
    );
  } else if (!process.env.ETH_RPC_URL?.trim()) {
    console.warn(
      "[NodeShare] ETH_RPC_URL unset — server will fall back to NEXT_PUBLIC_ETH_RPC_URL.",
    );
  }
  if (!process.env.RENDER_API_KEY?.trim()) {
    console.warn(
      "[NodeShare] RENDER_API_KEY not set — Render dashboard panel disabled (optional).",
    );
  }
}
