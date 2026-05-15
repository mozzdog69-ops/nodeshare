/**
 * Server-side ETH JSON-RPC URL validation and user-facing error text.
 */
export function validateEthRpcUrl(
  raw: string | undefined,
): { ok: true; url: string } | { ok: false; error: string } {
  const url = raw?.trim();
  if (!url) {
    return {
      ok: false,
      error:
        "ETH_RPC_URL is not set on the server. In Netlify/Vercel add your full Alchemy HTTPS URL (https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY), then redeploy.",
    };
  }

  if (
    url.includes("...") ||
    /YOUR_|REPLACE|INSERT|xxx/i.test(url) ||
    /\/v2\/?$/.test(url.replace(/\s+$/, ""))
  ) {
    return {
      ok: false,
      error:
        "ETH_RPC_URL is incomplete — it must include your Alchemy API key after /v2/, not a placeholder or trailing /v2/ alone.",
    };
  }

  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, error: "ETH_RPC_URL must start with https:// (or http:// for local dev)." };
    }
  } catch {
    return { ok: false, error: "ETH_RPC_URL is not a valid URL." };
  }

  return { ok: true, url };
}

/** Strip secrets from RPC errors shown in the UI. */
export function friendlyRpcError(message: string): string {
  const m = message.replace(/https?:\/\/[^\s"'<>]+/gi, "[RPC URL hidden]");
  if (/401|must be authenticated|unauthorized/i.test(message)) {
    return `${m} — Fix: set ETH_RPC_URL to your full Alchemy URL (https://eth-mainnet.g.alchemy.com/v2/<api-key>). Also set NEXT_PUBLIC_ETH_RPC_URL to the same value for client sends. Redeploy after saving env vars.`;
  }
  if (/403|forbidden/i.test(message)) {
    return `${m} — Check Alchemy app/network (Ethereum mainnet) and that the key is active.`;
  }
  return m;
}
