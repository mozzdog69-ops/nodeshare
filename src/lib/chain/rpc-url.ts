/**
 * Server-side ETH JSON-RPC URL validation and user-facing error text.
 */

/** Normalize values pasted from dashboards (quotes, spaces, BOM). */
export function sanitizeEnvUrl(raw: string | undefined): string {
  if (!raw) return "";
  let url = raw.trim().replace(/^\uFEFF/, "");
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim();
  }
  return url;
}

export function resolveEthRpcUrlFromEnv(env: {
  ETH_RPC_URL?: string;
  NEXT_PUBLIC_ETH_RPC_URL?: string;
}): { raw: string; source: "ETH_RPC_URL" | "NEXT_PUBLIC_ETH_RPC_URL" | null } {
  const server = sanitizeEnvUrl(env.ETH_RPC_URL);
  if (server) return { raw: server, source: "ETH_RPC_URL" };
  const pub = sanitizeEnvUrl(env.NEXT_PUBLIC_ETH_RPC_URL);
  if (pub) return { raw: pub, source: "NEXT_PUBLIC_ETH_RPC_URL" };
  return { raw: "", source: null };
}

export function resolveEthRpcUrl(): ReturnType<typeof resolveEthRpcUrlFromEnv> {
  return resolveEthRpcUrlFromEnv({
    ETH_RPC_URL: process.env.ETH_RPC_URL,
    NEXT_PUBLIC_ETH_RPC_URL: process.env.NEXT_PUBLIC_ETH_RPC_URL,
  });
}

export function validateEthRpcUrl(
  raw: string | undefined,
): { ok: true; url: string } | { ok: false; error: string } {
  const url = sanitizeEnvUrl(raw);
  if (!url) {
    return {
      ok: false,
      error:
        "No Ethereum RPC URL on the server. Set ETH_RPC_URL (preferred) or NEXT_PUBLIC_ETH_RPC_URL to your full Alchemy HTTPS URL, then redeploy.",
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
        "RPC URL is incomplete — include your Alchemy API key after /v2/, not a placeholder or trailing /v2/ alone.",
    };
  }

  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, error: "RPC URL must start with https:// (or http:// for local dev)." };
    }
  } catch {
    return { ok: false, error: "RPC URL is not a valid URL." };
  }

  return { ok: true, url };
}

/** Live JSON-RPC probe (no secrets returned). */
export async function probeEthRpc(
  url: string,
): Promise<{ ok: true; chainId: string } | { ok: false; status?: number; detail: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        detail:
          "Alchemy returned 401 — the API key in the URL is missing, wrong, or revoked. Copy the full HTTPS URL from Alchemy → your app → API key (not the app name).",
      };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, detail: `RPC HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
    let json: { result?: string; error?: { message?: string } };
    try {
      json = JSON.parse(text) as { result?: string; error?: { message?: string } };
    } catch {
      return { ok: false, detail: "RPC returned non-JSON" };
    }
    if (json.error?.message) {
      return { ok: false, detail: json.error.message };
    }
    if (!json.result) {
      return { ok: false, detail: "RPC returned no chain id" };
    }
    return { ok: true, chainId: json.result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: msg };
  }
}

/** Strip secrets from RPC errors shown in the UI. */
export function friendlyRpcError(message: string): string {
  const m = message.replace(/https?:\/\/[^\s"'<>]+/gi, "[RPC URL hidden]");
  if (/401|must be authenticated|unauthorized/i.test(message)) {
    return `${m} — Alchemy rejected the key. In Vercel/Netlify set ETH_RPC_URL to the full https://eth-mainnet.g.alchemy.com/v2/<key> (no quotes). Use the same value for NEXT_PUBLIC_ETH_RPC_URL. Redeploy after saving.`;
  }
  if (/403|forbidden/i.test(message)) {
    return `${m} — Check Alchemy app/network (Ethereum mainnet) and that the key is active.`;
  }
  return m;
}
