import { apiUrl } from "@/lib/api-base";
import type { GpuSigningWallet } from "@/lib/gpu/types";
import { Wallet } from "ethers";

function buildUserMessage(address: string, ts: number, method: string, path: string) {
  return `GPU_AUTH|${String(address).toLowerCase()}|${ts}|${String(method).toUpperCase()}|${path}`;
}

async function gpuAuthHeaders(wallet: GpuSigningWallet) {
  const ts = Date.now();
  const path = "/api/akash/terminal/session";
  const message = buildUserMessage(wallet.address, ts, "POST", path);
  const signer = new Wallet(wallet.privateKey);
  const signature = await signer.signMessage(message);
  return {
    "Content-Type": "application/json",
    "x-user-address": wallet.address,
    "x-user-ts": String(ts),
    "x-user-signature": signature,
  };
}

export type AkashTerminalSessionResult = {
  mode?: "iframe" | "ssh" | "console" | "provider_shell";
  token?: string;
  ws_path?: string;
  queued?: boolean;
  ssh?: { host: string; port: number; uri?: string };
  console_url?: string;
  host_uri?: string;
  shell_jwt?: string;
  provider?: string;
  dseq?: number;
  gseq?: number;
  oseq?: number;
  service?: string;
  provider_proxy_ws?: string;
  message?: string;
  lease_status?: unknown;
  error?: string;
};

export async function requestAkashTerminalSession(input: {
  wallet: GpuSigningWallet;
  mnemonic: string;
  owner: string;
  jobId: string;
  dseq: number;
  provider: string;
  gseq?: number;
  oseq?: number;
  clientCertificate?: { cert: string; privateKey: string; publicKey?: string } | null;
}): Promise<AkashTerminalSessionResult> {
  const headers = await gpuAuthHeaders(input.wallet);
  const res = await fetch(apiUrl("/api/akash/terminal/session"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      jobId: input.jobId,
      owner: input.owner,
      mnemonic: input.mnemonic.trim(),
      dseq: input.dseq,
      provider: input.provider,
      gseq: input.gseq ?? 1,
      oseq: input.oseq ?? 1,
      clientCertificate: input.clientCertificate ?? null,
    }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as AkashTerminalSessionResult & {
    ok?: boolean;
  };

  if (res.ok && json.token && json.ws_path) {
    return { mode: "iframe", token: json.token, ws_path: json.ws_path };
  }

  if (
    res.ok &&
    (json.mode === "ssh" || json.mode === "console" || json.mode === "provider_shell")
  ) {
    return json;
  }

  const err = String(json.error || `Terminal session HTTP ${res.status}`);
  if (res.status === 425 || json.queued) {
    throw new Error(err || "Waiting for provider to start your GPU…");
  }
  throw new Error(err);
}
