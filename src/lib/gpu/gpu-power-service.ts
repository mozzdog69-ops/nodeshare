import { apiUrl } from "@/lib/api-base";
import { filterAktPayableOffers } from "@/lib/gpu/akt-payment";
import { isLcdAkashOrderId, parseLcdAkashOrderId } from "@/lib/gpu/resolve-backend-offer";
import type { GpuJob, GpuOffer, GpuQuotePreview, GpuSigningWallet } from "@/lib/gpu/types";

const GPU_BASE = "/api/marketplace/gpu";

function buildUserMessage(address: string, ts: number, method: string, path: string) {
  return `GPU_AUTH|${String(address).toLowerCase()}|${ts}|${String(method).toUpperCase()}|${path}`;
}

async function buildUserHeaders(input: {
  wallet: GpuSigningWallet;
  method: string;
  path: string;
}) {
  const ts = Date.now();
  const message = buildUserMessage(input.wallet.address, ts, input.method, input.path);
  const { Wallet } = await import("ethers");
  const signer = new Wallet(input.wallet.privateKey);
  const signature = await signer.signMessage(message);
  return {
    "x-user-address": input.wallet.address,
    "x-user-ts": String(ts),
    "x-user-signature": signature,
  };
}

async function request<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    wallet?: GpuSigningWallet;
    idempotencyKey?: string;
    signPath?: string;
  } = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (opts.wallet) {
    Object.assign(
      headers,
      await buildUserHeaders({ wallet: opts.wallet, method, path: opts.signPath || path }),
    );
  }
  if (opts.idempotencyKey) {
    headers["Idempotency-Key"] = opts.idempotencyKey;
  }

  const url = apiUrl(`${GPU_BASE}${path}`);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `GPU API network error (${method} ${GPU_BASE}${path}): ${msg}. Set GPU_BACKEND_URL only if you run a provisioning server.`,
    );
  }

  const json = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `GPU API HTTP ${res.status}`);
  }
  return json;
}

export async function fetchAkashGpuOffers(): Promise<GpuOffer[]> {
  const json = await request<{ items?: GpuOffer[] }>("/offers?provider=akash&refresh=1");
  const rows = Array.isArray(json?.items) ? json.items : [];
  const akashRows = rows.filter((x) => {
    const providerCode = String(
      (x as GpuOffer & { provider_code?: string }).provider_code || "",
    ).toLowerCase();
    const providerId = String(
      (x as GpuOffer & { provider_id?: string }).provider_id || "",
    ).toLowerCase();
    const providerName = String(x.provider_name || x.provider || "").toLowerCase();
    return providerCode === "akash" || providerId.includes("akash") || providerName.includes("akash");
  });
  const scoped = akashRows.length > 0 ? akashRows : rows;
  return filterAktPayableOffers(scoped);
}

export async function createGpuQuote(input: {
  wallet: GpuSigningWallet;
  offerId: string;
  estimatedRuntimeMinutes: number;
  paymentAsset: string;
  /** Original Akash LCD bid id (dseq-gseq-oseq) for provider placement */
  lcdOrderId?: string;
  providerOwner?: string;
}) {
  const body: Record<string, unknown> = {
    user_id: input.wallet.address.toLowerCase(),
    offer_id: input.offerId,
    estimated_runtime: input.estimatedRuntimeMinutes,
    payment_asset: input.paymentAsset,
  };
  const lcdRef = String(input.lcdOrderId || "").trim();
  if (isLcdAkashOrderId(lcdRef)) {
    body.akash_order_id = lcdRef;
    const parts = parseLcdAkashOrderId(lcdRef);
    if (parts) {
      body.akash_dseq = parts.dseq;
      body.akash_gseq = parts.gseq;
      body.akash_oseq = parts.oseq;
    }
  }
  const owner = String(input.providerOwner || "").trim();
  if (owner.startsWith("akash1")) {
    body.akash_provider_owner = owner;
  }

  return request<GpuQuotePreview>("/quotes", {
    method: "POST",
    wallet: input.wallet,
    body,
  });
}

export async function createGpuJob(input: {
  wallet: GpuSigningWallet;
  quoteId: string;
  title: string;
  category: string;
  fileManifest: { name: string; kind: string; size: number }[];
}) {
  return request<{ job: GpuJob }>("/jobs", {
    method: "POST",
    wallet: input.wallet,
    body: {
      user_id: input.wallet.address.toLowerCase(),
      quote_id: input.quoteId,
      title: input.title,
      category: input.category,
      file_manifest: input.fileManifest,
    },
  });
}

export async function confirmGpuPayment(input: {
  wallet: GpuSigningWallet;
  jobId: string;
  txHash: string;
  paymentAsset: string;
  chainId: number | string;
  idempotencyKey?: string;
  recoveryJob?: Record<string, unknown> | null;
}) {
  const stableIdempotencyKey =
    input.idempotencyKey || `gpu-pay-${input.jobId}-${Date.now()}`;
  return request<{ ok?: boolean; job?: GpuJob; payment?: unknown }>(
    `/jobs/${input.jobId}/pay`,
    {
      method: "POST",
      wallet: input.wallet,
      idempotencyKey: stableIdempotencyKey,
      body: {
        tx_hash: input.txHash,
        payment_asset: input.paymentAsset,
        chain_id: input.chainId,
        recovery_job: input.recoveryJob || null,
      },
    },
  );
}

export async function fetchGpuJobs(input: { wallet: GpuSigningWallet; status?: string }) {
  const query = new URLSearchParams({
    user_id: input.wallet.address.toLowerCase(),
    ...(input.status ? { status: input.status } : {}),
  });
  return request<{ items?: GpuJob[] }>(`/jobs?${query.toString()}`, {
    method: "GET",
    wallet: input.wallet,
    signPath: "/jobs",
  });
}

export async function fetchGpuJobById(input: { wallet: GpuSigningWallet; jobId: string }) {
  return request<{ job?: GpuJob }>(`/jobs/${input.jobId}`, {
    method: "GET",
    wallet: input.wallet,
  });
}

export async function requestGpuTerminalSession(input: {
  wallet: GpuSigningWallet;
  jobId: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}) {
  return request<{ token?: string; ws_path?: string }>(`/jobs/${input.jobId}/terminal/session`, {
    method: "POST",
    wallet: input.wallet,
    body: {
      ssh_private_key: input.sshPrivateKey || "",
      ssh_passphrase: input.sshPassphrase || "",
    },
  });
}