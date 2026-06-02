/** Normalize provider host URI and block SSRF targets for server-side proxy. */
export function normalizeProviderHostUri(hostUri: string): string {
  const trimmed = hostUri.trim().replace(/\/$/, "");
  const base = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const url = new URL(base);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Provider host must use http or https.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Provider host URI is not reachable from NodeShare.");
  }
  return `${url.protocol}//${url.host}`;
}

/** Akash provider gateway: PUT /deployment/{dseq}/manifest (JWT or mTLS). */
export function manifestUploadUrl(hostUri: string, dseq: number): string {
  const d = Math.floor(Number(dseq));
  if (!Number.isFinite(d) || d <= 0) {
    throw new Error("Invalid deployment sequence for manifest upload.");
  }
  return `${normalizeProviderHostUri(hostUri)}/deployment/${d}/manifest`;
}
