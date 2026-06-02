import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import {
  readManifestCertificatePem,
  saveManifestCertificatePem,
} from "@/lib/akash/manifest-certificate-storage";
import { manifestUploadUrl, normalizeProviderHostUri } from "@/lib/akash/provider-host-uri";
import {
  rentDebugRequestHeaders,
  saveManifestUploadDebug,
  type ManifestUploadDebugSnapshot,
} from "@/lib/akash/rent-debug";
import { apiUrl } from "@/lib/api-base";
import type { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";

export class ManifestUploadFailedError extends Error {
  readonly debug: ManifestUploadDebugSnapshot;

  constructor(message: string, debug: ManifestUploadDebugSnapshot) {
    super(message);
    this.name = "ManifestUploadFailedError";
    this.debug = debug;
  }
}

export type SendManifestInput = {
  hostUri: string;
  dseq: number;
  owner: string;
  provider: string;
  /** Optional — server rebuilds manifest from on-chain deployment when omitted. */
  manifestJson?: string;
  wallet: DirectSecp256k1HdWallet;
  mnemonic: string;
};

function hasManifestUploadDiagnostics(raw: string): boolean {
  return /\b(stored certificate|new on-chain certificate|publish:|mTLS:|JWT:)\b/i.test(raw);
}

/** Provider will keep rejecting — retry only burns gas. */
export function isNonRetryableManifestError(message: string): boolean {
  const raw = String(message || "");
  if (/provider's bid does not match|bid does not match what you deployed/i.test(raw)) {
    return true;
  }
  return (
    /manifest version validation failed/i.test(raw) &&
    (/hash matches on-chain|hash is correct|provider still rejected/i.test(raw) ||
      hasManifestUploadDiagnostics(raw))
  );
}

export function formatManifestUploadError(raw: string): string {
  if (/failed to fetch|networkerror|load failed/i.test(raw) && !/manifest upload failed/i.test(raw)) {
    return (
      "Could not reach the NodeShare manifest API. Redeploy the latest build, refresh, and tap Retry manifest."
    );
  }
  if (/jwt has invalid claims/i.test(raw)) {
    return (
      "Provider rejected the auth token. If this lease expired (manifest timeout), close the deployment on Stuck orders and rent again. Otherwise redeploy the latest NodeShare build and retry."
    );
  }
  if (/manifest version validation failed/i.test(raw)) {
    if (isNonRetryableManifestError(raw)) {
      return (
        raw +
        " Close this deployment (Close & recover ACT) and rent again — pick a different provider if it keeps failing."
      );
    }
    return (
      "Provider rejected manifest delivery. Redeploy the latest NodeShare build, then retry once; if hash matches in debug, close and rent again on another host."
    );
  }
  if (/Provider rejected manifest over mTLS/i.test(raw)) {
    return raw;
  }
  if (/could not build a manifest matching/i.test(raw)) {
    return raw;
  }
  if (/akash network data is temporarily unavailable/i.test(raw)) {
    return raw;
  }
  if (/cannot unmarshal number.*type string/i.test(raw)) {
    return (
      "Manifest JSON format was rejected by the provider. Redeploy the latest NodeShare build and rent again — or tap Retry manifest after redeploy."
    );
  }
  return raw;
}

/** Upload manifest via NodeShare API (server signs JWT with chain-sdk + relays to provider). */
export async function sendManifestToProvider(input: SendManifestInput): Promise<void> {
  const proxyUrl = apiUrl("/api/akash/manifest");
  const clientCertificate = readManifestCertificatePem(input.owner);
  const payload: Record<string, unknown> = {
    hostUri: input.hostUri,
    dseq: input.dseq,
    owner: input.owner,
    provider: input.provider,
    mnemonic: input.mnemonic,
  };
  const manifestJson = input.manifestJson?.trim();
  if (manifestJson) payload.manifestJson = manifestJson;
  if (clientCertificate) payload.clientCertificate = clientCertificate;

  let res: Response;
  try {
    res = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...rentDebugRequestHeaders(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(115_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Manifest proxy request failed";
    throw new Error(formatManifestUploadError(msg));
  }

  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    status?: number;
    mtlsError?: string;
    jwtError?: string;
    method?: string;
    onChainHash?: string;
    uploadHash?: string;
    hashVerified?: boolean;
    savedCertificate?: AkashCertificatePem;
  } | null;

  if (json?.savedCertificate?.cert && json.savedCertificate.privateKey) {
    saveManifestCertificatePem(input.owner, json.savedCertificate);
  }

  if (!res.ok || !json?.ok) {
    const primary =
      json?.error?.trim() || res.statusText || "Manifest proxy failed";
    const head = formatManifestUploadError(
      json?.status ? `Manifest upload failed (${json.status}): ${primary}` : `Manifest upload failed: ${primary}`,
    );
    const extras: string[] = [];
    const mtls = json?.mtlsError?.trim();
    const jwt = json?.jwtError?.trim();
    if (mtls && !head.includes(mtls)) extras.push(`mTLS: ${mtls}`);
    if (jwt && jwt !== primary && !head.includes(jwt)) extras.push(`JWT: ${jwt}`);
    const detail = extras.length ? `${head}\n\n${extras.join("\n")}` : head;

    const debug: ManifestUploadDebugSnapshot = {
      at: new Date().toISOString(),
      httpStatus: res.status,
      error: json?.error,
      mtlsError: json?.mtlsError,
      jwtError: json?.jwtError,
      onChainHash: json?.onChainHash,
      uploadHash: json?.uploadHash,
      hashVerified: json?.hashVerified,
      method: json?.method,
      request: {
        hostUri: input.hostUri,
        dseq: input.dseq,
        owner: input.owner,
        provider: input.provider,
        hadClientCert: Boolean(clientCertificate),
        manifestJsonChars: manifestJson?.length ?? 0,
      },
    };
    saveManifestUploadDebug(debug);
    throw new ManifestUploadFailedError(detail, debug);
  }
}

/** Server-side PUT to provider (used by API route). */
export async function sendManifestToProviderDirect(input: {
  hostUri: string;
  dseq: number;
  authorization: string;
  manifestJson: string;
}): Promise<{ status: number; ok: boolean; error?: string }> {
  const url = manifestUploadUrl(input.hostUri, input.dseq);
  const auth = input.authorization.startsWith("Bearer ")
    ? input.authorization
    : `Bearer ${input.authorization}`;
  const manifestJson = input.manifestJson.trim();
  if (!manifestJson) {
    return { status: 400, ok: false, error: "manifestJson is required" };
  }

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: manifestJson,
      signal: AbortSignal.timeout(75_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: res.status,
        ok: false,
        error: text.slice(0, 400) || res.statusText,
      };
    }
    return { status: res.status, ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Provider unreachable";
    return { status: 0, ok: false, error: msg };
  }
}

export { normalizeProviderHostUri };
