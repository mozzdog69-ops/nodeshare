import https from "node:https";
import { manifestUploadUrl } from "@/lib/akash/provider-host-uri";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";

/** PUT manifest to provider using Akash mTLS (documented GPU provider path). */
export function sendManifestToProviderMtls(input: {
  hostUri: string;
  dseq: number;
  manifestJson: string;
  certificate: AkashCertificatePem;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const url = new URL(manifestUploadUrl(input.hostUri, input.dseq));
  const body = input.manifestJson;

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
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
            resolve({ ok: true, status: res.statusCode });
            return;
          }
          resolve({
            ok: false,
            status: res.statusCode || 502,
            error: data.slice(0, 500) || res.statusMessage,
          });
        });
      },
    );
    req.setTimeout(70_000, () => {
      req.destroy(new Error("mTLS manifest upload timed out"));
    });
    req.on("error", (e) => {
      resolve({ ok: false, status: 0, error: e instanceof Error ? e.message : "mTLS request failed" });
    });
    req.write(body);
    req.end();
  });
}
