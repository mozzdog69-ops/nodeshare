import { isValidAkashAddress, sanitizeAkashAddress } from "@/lib/akash/akash-address";
import type { AkashCertificatePem } from "@/lib/akash/akash-certificate";
import { fetchDeploymentHashLcd } from "@/lib/akash/fetch-deployment-hash";
import {
  manifestHashBase64BrokenStrip,
  manifestHashBase64FromJson,
  manifestHashBase64SdkLegacy,
  manifestHashBase64StrippedCanon,
} from "@/lib/akash/manifest-version-go";
import { parseGpuSdl, type GpuSdlInput } from "@/lib/akash/gpu-sdl";
import { inferGpuSdlFromDeploymentRow } from "@/lib/akash/recover-manifest-json";
import { uploadManifestToProvider } from "@/lib/akash/manifest-upload.server";
import {
  bidDeploymentMismatchUserMessage,
  compareBidToDeployment,
} from "@/lib/akash/bid-deployment-alignment";
import { fetchLeaseProviderBidLcd } from "@/lib/akash/fetch-deployment-bids";
import {
  fetchDeploymentRowLcd,
  resolveManifestJsonForDeployment,
} from "@/lib/akash/recover-manifest-json";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  let payload: {
    hostUri?: string;
    dseq?: number | string;
    owner?: string;
    provider?: string;
    manifestJson?: string;
    mnemonic?: string;
    clientCertificate?: AkashCertificatePem;
  };

  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const hostUri = String(payload.hostUri || "").trim();
  const dseq = Math.floor(Number(payload.dseq ?? 0));
  const manifestJson = String(payload.manifestJson || "").trim();
  const owner = sanitizeAkashAddress(payload.owner);
  const provider = sanitizeAkashAddress(payload.provider);
  const mnemonic = String(payload.mnemonic || "").trim();

  if (!hostUri || !dseq || !owner || !provider) {
    return NextResponse.json(
      { ok: false, error: "hostUri, dseq, owner, and provider are required" },
      { status: 400 },
    );
  }

  if (!isValidAkashAddress(owner)) {
    return NextResponse.json({ ok: false, error: "Invalid owner address" }, { status: 400 });
  }

  if (!mnemonic) {
    return NextResponse.json(
      { ok: false, error: "Unlock your wallet and retry — mnemonic is required for manifest upload." },
      { status: 400 },
    );
  }

  let bodyJson: string;
  try {
    bodyJson = await resolveManifestJsonForDeployment({
      owner,
      dseq,
      manifestJson: manifestJson || undefined,
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not resolve manifest for this deployment.";
    return NextResponse.json({ ok: false, error: msg }, { status: 409 });
  }

  const onChainHash = await fetchDeploymentHashLcd(owner, dseq);
  const depRow = await fetchDeploymentRowLcd(owner, dseq);
  let uploadBody = bodyJson;
  let providerHash = "";
  let parsedFromRow: Awaited<ReturnType<typeof parseGpuSdl>> | null = null;

  if (depRow && onChainHash) {
    try {
      const hints: GpuSdlInput = { hourlyAkt: 0.12, hours: 1 };
      parsedFromRow = await parseGpuSdl(inferGpuSdlFromDeploymentRow(depRow, hints));
      uploadBody = parsedFromRow.manifestJson;
      providerHash = Buffer.from(parsedFromRow.hash).toString("base64");
    } catch {
      /* fall through to client manifest */
    }
  }

  if (!providerHash) {
    try {
      const parsed = JSON.parse(bodyJson) as unknown;
      providerHash = await manifestHashBase64FromJson(uploadBody);
      const legacyHash = await manifestHashBase64SdkLegacy(parsed);
      const brokenHash = await manifestHashBase64BrokenStrip(parsed);
      if (onChainHash && legacyHash === onChainHash) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This deployment uses an old manifest hash that GPU providers reject. Close it on Stuck orders (recover ACT), then rent again.",
            legacyOnChain: true,
          },
          { status: 409 },
        );
      }
      if (onChainHash && brokenHash === onChainHash) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This deployment manifest hash cannot be delivered to providers. Close it on Stuck orders (recover ACT), redeploy the latest NodeShare build, and rent again.",
            brokenStrip: true,
          },
          { status: 409 },
        );
      }
    } catch {
      /* keep defaults */
    }
  }

  if (onChainHash && providerHash && providerHash !== onChainHash) {
    if (parsedFromRow) {
      const strippedHash = await manifestHashBase64StrippedCanon(
        parsedFromRow.manifest,
        (jsonStr) =>
          (parsedFromRow.sdl as { SortJSON: (j: string) => string }).SortJSON(jsonStr),
      );
      if (strippedHash === onChainHash) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This deployment manifest hash cannot be delivered to GPU providers (prior NodeShare build). Close it on Stuck orders (recover ACT), then rent again.",
            strippedCanon: true,
          },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      {
        ok: false,
        error: `Manifest hash mismatch before upload (on-chain ${onChainHash.slice(0, 8)}…, provider ${providerHash.slice(0, 8)}…). Close and rent again.`,
      },
      { status: 409 },
    );
  }

  const manifestHashVerified = Boolean(onChainHash && providerHash === onChainHash);
  bodyJson = uploadBody;
  const leaseBid = await fetchLeaseProviderBidLcd(owner, dseq, provider);
  const bidAlignment = compareBidToDeployment(depRow, leaseBid?.resources ?? null);
  const bidMismatchDetail =
    bidAlignment && !bidAlignment.aligned
      ? bidDeploymentMismatchUserMessage(bidAlignment)
      : undefined;

  const result = await uploadManifestToProvider({
    mnemonic,
    owner,
    provider,
    hostUri,
    dseq,
    manifestJson: bodyJson,
    manifestHashVerified,
    skipUploadBidMismatch: Boolean(bidMismatchDetail),
    bidMismatchDetail,
    clientCertificate: payload.clientCertificate ?? null,
  });

  if (!result.ok) {
    const hashVerified = manifestHashVerified;
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        mtlsError: result.mtlsError,
        jwtError: result.jwtError,
        onChainHash: onChainHash ?? undefined,
        uploadHash: providerHash || undefined,
        hashVerified,
        providerRejectedVerifiedManifest:
          "providerRejectedVerifiedManifest" in result
            ? Boolean(result.providerRejectedVerifiedManifest)
            : false,
        bidMismatch: Boolean(bidMismatchDetail),
        bidAlignment: bidAlignment
          ? { aligned: bidAlignment.aligned, issues: bidAlignment.issues }
          : undefined,
        savedCertificate:
          "savedCertificate" in result ? result.savedCertificate : undefined,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    method: result.method,
    uploadHash: providerHash || undefined,
    savedCertificate: "savedCertificate" in result ? result.savedCertificate : undefined,
  });
}
