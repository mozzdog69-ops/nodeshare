"use client";

import { apiUrl } from "@/lib/api-base";
import { readManifestCertificatePem } from "@/lib/akash/manifest-certificate-storage";
import {
  isAkashRentDebugEnabled,
  readManifestUploadDebug,
  rentDebugRequestHeaders,
  shouldShowAkashRentDebug,
  type ManifestUploadDebugSnapshot,
} from "@/lib/akash/rent-debug";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type ManifestDiagnostics = {
  at: string;
  dseq: number;
  owner: string;
  onChainHash: string | null;
  uploadHash: string | null;
  hashMatch: boolean;
  clientManifestHash: string | null;
  clientManifestMatchesOnChain: boolean;
  resolveError: string | null;
  manifestByteLength: number;
  manifestPreview: string | null;
  inferredSdl: Record<string, unknown> | null;
  onChainGpuAttributes: string[];
  lease: { provider?: string; state?: string; reason?: string } | null;
  canRetryManifest: boolean;
  retryBlockedReason: string | null;
  provider: string | null;
  hostUri: string | null;
  manifestUploadPath: string | null;
  hints: string[];
  bidAlignment?: {
    aligned: boolean;
    issues: string[];
    deployment: Record<string, unknown>;
    bid: Record<string, unknown>;
  } | null;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid gap-0.5 border-b border-slate-200/80 py-2 last:border-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="break-all font-mono text-[11px] text-slate-900">{value}</dd>
    </div>
  );
}

export function AkashRentDebugPanel(props: {
  owner: string | null | undefined;
  dseq: number | null | undefined;
  clientManifestJson?: string;
  /** When true, panel is shown (manifest failure auto-enables). */
  forceVisible?: boolean;
}) {
  const enabled = shouldShowAkashRentDebug(Boolean(props.forceVisible));
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [diag, setDiag] = useState<ManifestDiagnostics | null>(null);
  const [diagError, setDiagError] = useState("");
  const [uploadDebug, setUploadDebug] = useState<ManifestUploadDebugSnapshot | null>(() =>
    readManifestUploadDebug(),
  );

  const refresh = useCallback(async () => {
    const owner = props.owner?.trim();
    const dseq = props.dseq;
    if (!enabled || !owner || !dseq) return;

    setLoading(true);
    setDiagError("");
    try {
      const qs = new URLSearchParams({
        owner,
        dseq: String(dseq),
      });
      if (props.clientManifestJson?.trim()) {
        qs.set("clientManifest", props.clientManifestJson.trim().slice(0, 8000));
      }
      const res = await fetch(apiUrl(`/api/akash/manifest/debug?${qs}`), {
        cache: "no-store",
        headers: rentDebugRequestHeaders(),
      });
      const json = (await res.json()) as ManifestDiagnostics & { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setDiagError(json.error || `HTTP ${res.status}`);
        setDiag(null);
        return;
      }
      setDiag(json);
    } catch (e) {
      setDiagError(e instanceof Error ? e.message : "Diagnostics fetch failed");
    } finally {
      setLoading(false);
    }
  }, [enabled, props.owner, props.dseq, props.clientManifestJson]);

  useEffect(() => {
    if (enabled && props.owner && props.dseq) void refresh();
  }, [enabled, props.owner, props.dseq, refresh]);

  useEffect(() => {
    setUploadDebug(readManifestUploadDebug());
  }, [props.dseq]);

  if (!enabled) return null;

  const owner = props.owner?.trim() ?? "";
  const hasStoredCert = owner ? Boolean(readManifestCertificatePem(owner)) : false;
  const copyPayload = {
    diagnostics: diag,
    lastUpload: uploadDebug,
    hasStoredClientCert: hasStoredCert,
    clientManifestChars: props.clientManifestJson?.length ?? 0,
  };

  return (
    <Card className="border-violet-300 bg-violet-50/80">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-4 pb-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-violet-800">Dev · Akash rent debug</p>
          <p className="mt-0.5 text-[11px] text-violet-900/80">
            Shown automatically when manifest upload fails. Optional:{" "}
            <code className="rounded bg-white/60 px-1">?rentDebug=1</code> on any visit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-7 text-[10px]"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-7 text-[10px]"
            disabled={loading || !owner || !props.dseq}
            onClick={() => void refresh()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-7 text-[10px]"
            onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(copyPayload, null, 2));
            }}
          >
            Copy JSON
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4 p-4 pt-0 text-xs">
          {diagError ? <p className="text-rose-800">{diagError}</p> : null}

          {diag?.hints?.length ? (
            <ul className="list-disc space-y-1 pl-4 text-violet-950">
              {diag.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}

          <dl className="rounded-md border border-violet-200 bg-white/70 px-3">
            <Row label="dseq" value={props.dseq != null ? String(props.dseq) : null} />
            <Row label="owner" value={owner || null} />
            <Row label="on-chain manifest hash" value={diag?.onChainHash} />
            <Row label="resolved upload hash" value={diag?.uploadHash} />
            <Row
              label="hash match"
              value={
                diag == null ? null : diag.hashMatch ? "yes — bytes match deployment" : "NO — mismatch"
              }
            />
            <Row label="client manifest hash" value={diag?.clientManifestHash} />
            <Row
              label="client manifest matches on-chain"
              value={
                diag == null
                  ? null
                  : diag.clientManifestMatchesOnChain
                    ? "yes"
                    : diag.clientManifestHash
                      ? "no"
                      : "n/a"
              }
            />
            <Row label="resolve error" value={diag?.resolveError} />
            <Row label="manifest bytes" value={diag != null ? String(diag.manifestByteLength) : null} />
            <Row label="lease state" value={diag?.lease?.state} />
            <Row label="lease reason" value={diag?.lease?.reason} />
            <Row label="provider" value={diag?.provider} />
            <Row label="host URI" value={diag?.hostUri} />
            <Row label="PUT path" value={diag?.manifestUploadPath} />
            <Row label="stored browser mTLS cert" value={hasStoredCert ? "yes" : "no"} />
            <Row
              label="inferred SDL"
              value={diag?.inferredSdl ? JSON.stringify(diag.inferredSdl) : null}
            />
            <Row
              label="on-chain GPU attrs"
              value={
                diag?.onChainGpuAttributes?.length
                  ? diag.onChainGpuAttributes.join(", ")
                  : null
              }
            />
            <Row
              label="bid vs deployment"
              value={
                diag?.bidAlignment == null
                  ? null
                  : diag.bidAlignment.aligned
                    ? "aligned"
                    : `MISMATCH — ${diag.bidAlignment.issues.join("; ")}`
              }
            />
          </dl>

          {uploadDebug ? (
            <div>
              <p className="mb-1 font-semibold text-violet-900">Last manifest upload API response</p>
              <pre className="max-h-48 overflow-auto rounded-md border border-violet-200 bg-white/80 p-2 font-mono text-[10px] text-slate-900">
                {JSON.stringify(uploadDebug, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-violet-900/70">No upload attempt recorded yet — tap Retry manifest.</p>
          )}

          {diag?.manifestPreview ? (
            <div>
              <p className="mb-1 font-semibold text-violet-900">Resolved manifest preview</p>
              <pre className="max-h-40 overflow-auto rounded-md border border-violet-200 bg-white/80 p-2 font-mono text-[10px] text-slate-900">
                {diag.manifestPreview}
                {diag.manifestByteLength > 400 ? "\n…" : ""}
              </pre>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
