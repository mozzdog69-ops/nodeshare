import https from "node:https";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { DEFAULT_GPU_SDL_SERVICE } from "@/lib/akash/akash-provider-auth";
import { normalizeProviderHostUri } from "@/lib/akash/provider-host-uri";

export type ForwardedPort = {
  host?: string;
  port?: number;
  externalPort?: number;
  available?: number;
};

export type ProviderLeaseStatus = {
  services: Record<
    string,
    {
      name?: string;
      ready_replicas?: number;
      available_replicas?: number;
      replicas?: number;
      total?: number;
      uris?: string[];
    }
  >;
  forwarded_ports: Record<string, ForwardedPort[]>;
  ips: Record<string, ForwardedPort[]>;
};

export function sshEndpointFromLeaseStatus(
  status: ProviderLeaseStatus,
  serviceName = DEFAULT_GPU_SDL_SERVICE,
): { host: string; port: number; uri?: string } | null {
  const svc = status.services?.[serviceName];
  const uri = svc?.uris?.[0];
  if (uri) {
    try {
      const u = uri.includes("://") ? new URL(uri) : new URL(`https://${uri}`);
      const port = Number(u.port) || 22;
      return { host: u.hostname, port, uri };
    } catch {
      return { host: uri.replace(/^https?:\/\//, "").split("/")[0] ?? uri, port: 22, uri };
    }
  }

  const forwards = status.forwarded_ports?.[serviceName] ?? [];
  for (const row of forwards) {
    const port = Number(row.externalPort ?? row.port ?? 0);
    const host = String(row.host || "").trim();
    if (host && port > 0) return { host, port };
  }

  const ipRows = status.ips?.[serviceName] ?? [];
  for (const row of ipRows) {
    const port = Number(row.externalPort ?? row.port ?? 0);
    const host = String(row.host || (row as { IP?: string }).IP || "").trim();
    if (host && port > 0) return { host, port };
  }

  return null;
}

export function leaseWorkloadReady(status: ProviderLeaseStatus, serviceName = DEFAULT_GPU_SDL_SERVICE): boolean {
  const svc = status.services?.[serviceName];
  if (!svc) return false;
  const ready = Number(svc.ready_replicas ?? 0);
  const total = Number(svc.total ?? svc.replicas ?? 0);
  if (ready > 0) return true;
  if (sshEndpointFromLeaseStatus(status, serviceName)) return true;
  return total > 0 && Number(svc.available_replicas ?? 0) > 0;
}

function parseLeaseStatusBody(text: string): ProviderLeaseStatus {
  try {
    return JSON.parse(text) as ProviderLeaseStatus;
  } catch {
    throw new Error("Provider returned invalid lease status JSON.");
  }
}

export async function fetchProviderLeaseStatus(input: {
  hostUri: string;
  dseq: number;
  gseq: number;
  oseq: number;
  jwt: string;
}): Promise<ProviderLeaseStatus> {
  const base = normalizeProviderHostUri(input.hostUri);
  const url = `${base}/lease/${input.dseq}/${input.gseq}/${input.oseq}/status`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.jwt}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text.slice(0, 280) || `Provider lease status HTTP ${res.status}`,
    );
  }
  return parseLeaseStatusBody(text);
}

/** Provider lease status over mTLS (same cert as manifest upload). */
export function fetchProviderLeaseStatusMtls(input: {
  hostUri: string;
  dseq: number;
  gseq: number;
  oseq: number;
  certificate: AkashCertificatePem;
}): Promise<ProviderLeaseStatus> {
  const base = normalizeProviderHostUri(input.hostUri);
  const path = `/lease/${input.dseq}/${input.gseq}/${input.oseq}/status`;
  const url = new URL(`${base}${path}`);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Accept: "application/json" },
        cert: input.certificate.cert,
        key: input.certificate.privateKey,
        rejectUnauthorized: false,
        servername: "",
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(parseLeaseStatusBody(data));
            } catch (e) {
              reject(e);
            }
            return;
          }
          reject(
            new Error(data.slice(0, 280) || `Provider lease status mTLS HTTP ${res.statusCode}`),
          );
        });
      },
    );
    req.setTimeout(45_000, () => {
      req.destroy(new Error("Provider lease status mTLS timed out"));
    });
    req.on("error", (e) => {
      reject(e instanceof Error ? e : new Error("Provider lease status mTLS failed"));
    });
    req.end();
  });
}

export async function fetchProviderLeaseStatusResolved(input: {
  hostUri: string;
  dseq: number;
  gseq: number;
  oseq: number;
  jwt: string;
  certificate?: AkashCertificatePem | null;
}): Promise<ProviderLeaseStatus> {
  const errors: string[] = [];
  try {
    return await fetchProviderLeaseStatus({
      hostUri: input.hostUri,
      dseq: input.dseq,
      gseq: input.gseq,
      oseq: input.oseq,
      jwt: input.jwt,
    });
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (input.certificate?.cert && input.certificate.privateKey) {
    try {
      return await fetchProviderLeaseStatusMtls({
        hostUri: input.hostUri,
        dseq: input.dseq,
        gseq: input.gseq,
        oseq: input.oseq,
        certificate: input.certificate,
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error(errors[errors.length - 1] || "Could not read provider lease status.");
}
