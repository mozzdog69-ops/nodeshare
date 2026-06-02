import { sanitizeAkashAddress } from "@/lib/akash/akash-address";
import { fetchDeploymentHashLcd } from "@/lib/akash/fetch-deployment-hash";
import { fetchLeaseInfoLcd, leaseManifestRetryBlockedReason } from "@/lib/akash/fetch-lease-info";
import { manifestHashBase64FromJson } from "@/lib/akash/manifest-version-go";
import {
  fetchDeploymentRowLcd,
  inferGpuSdlFromDeploymentRow,
  recoverManifestJsonForDeployment,
  resolveManifestJsonForDeployment,
} from "@/lib/akash/recover-manifest-json";
import {
  bidDeploymentMismatchUserMessage,
  compareBidToDeployment,
} from "@/lib/akash/bid-deployment-alignment";
import { fetchLeaseProviderBidLcd } from "@/lib/akash/fetch-deployment-bids";
import { isAkashRentDebugRequest } from "@/lib/akash/rent-debug.server";
import {
  AKASH_FETCH_HEADERS,
  AKASH_FETCH_TIMEOUT_MS,
  DEFAULT_AKASH_LCD_BASES,
} from "@/lib/akash/lcd-endpoints";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchProviderHostUriLcd(provider: string): Promise<string | null> {
  const bases = (
    process.env.AKASH_LCD_URL?.trim()
      ? [process.env.AKASH_LCD_URL.trim()]
      : [...DEFAULT_AKASH_LCD_BASES]
  ).map((b) => b.replace(/\/$/, ""));

  for (const base of bases) {
    const url = `${base}/akash/provider/v1beta4/providers/${provider}`;
    try {
      const res = await fetch(url, {
        headers: AKASH_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(AKASH_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        provider?: { host_uri?: string; hostUri?: string };
      };
      const uri = String(json.provider?.host_uri ?? json.provider?.hostUri ?? "").trim();
      if (uri) return uri.replace(/\/$/, "");
    } catch {
      /* next */
    }
  }
  return null;
}

export async function GET(req: Request) {
  if (!isAkashRentDebugRequest(req)) {
    return NextResponse.json({ ok: false, error: "Rent debug is disabled." }, { status: 404 });
  }

  const url = new URL(req.url);
  const owner = sanitizeAkashAddress(url.searchParams.get("owner"));
  const dseq = Math.floor(Number(url.searchParams.get("dseq") ?? 0));
  const clientManifest = url.searchParams.get("clientManifest")?.trim() || undefined;

  if (!owner || !dseq) {
    return NextResponse.json({ ok: false, error: "owner and dseq are required" }, { status: 400 });
  }

  const onChainHash = await fetchDeploymentHashLcd(owner, dseq);
  const row = await fetchDeploymentRowLcd(owner, dseq);
  const inferred = row ? inferGpuSdlFromDeploymentRow(row, { hourlyAkt: 0.12, hours: 1 }) : null;
  const lease = await fetchLeaseInfoLcd(owner, dseq);
  const provider = lease?.provider ?? null;
  const hostUri = provider ? await fetchProviderHostUriLcd(provider) : null;

  let resolvedManifest: string | null = null;
  let resolveError: string | null = null;
  let uploadHash: string | null = null;

  try {
    resolvedManifest = await resolveManifestJsonForDeployment({
      owner,
      dseq,
      manifestJson: clientManifest,
    });
    uploadHash = await manifestHashBase64FromJson(resolvedManifest);
  } catch (e) {
    resolveError = e instanceof Error ? e.message : "resolve failed";
    if (onChainHash) {
      resolvedManifest = await recoverManifestJsonForDeployment(owner, dseq, onChainHash, {
        hourlyAkt: 0.12,
        hours: 1,
      });
      if (resolvedManifest) {
        uploadHash = await manifestHashBase64FromJson(resolvedManifest);
        resolveError = `${resolveError} (recovered via variants)`;
      }
    }
  }

  let clientHash: string | null = null;
  if (clientManifest) {
    try {
      clientHash = await manifestHashBase64FromJson(clientManifest);
    } catch {
      clientHash = null;
    }
  }

  const gpuAttrs =
    row?.groups?.[0]?.group_spec?.resources?.[0]?.resource?.gpu?.attributes?.map(
      (a) => `${a.key}=${a.value}`,
    ) ?? [];

  const leaseBid = provider ? await fetchLeaseProviderBidLcd(owner, dseq, provider) : null;
  const bidAlignment = compareBidToDeployment(row, leaseBid?.resources ?? null);

  const hints: string[] = [];
  if (bidAlignment && !bidAlignment.aligned) {
    hints.push(bidDeploymentMismatchUserMessage(bidAlignment));
  } else if (onChainHash && uploadHash && onChainHash === uploadHash) {
    hints.push(
      "Resolved manifest hash matches on-chain deployment. If upload still fails, contact the provider with this dseq.",
    );
  } else if (onChainHash && uploadHash && onChainHash !== uploadHash) {
    hints.push("Resolved manifest hash does NOT match on-chain — do not retry until recovery logic is fixed.");
  }
  if (clientHash && onChainHash && clientHash !== onChainHash) {
    hints.push("Browser-stored manifestJson hash differs from on-chain — server should ignore it when resolving.");
  }
  if (leaseManifestRetryBlockedReason(lease)) {
    hints.push(leaseManifestRetryBlockedReason(lease)!);
  }

  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    dseq,
    owner,
    onChainHash,
    uploadHash,
    hashMatch: Boolean(onChainHash && uploadHash && onChainHash === uploadHash),
    clientManifestHash: clientHash,
    clientManifestMatchesOnChain: Boolean(
      clientHash && onChainHash && clientHash === onChainHash,
    ),
    resolveError,
    manifestByteLength: resolvedManifest?.length ?? 0,
    manifestPreview: resolvedManifest ? resolvedManifest.slice(0, 400) : null,
    inferredSdl: inferred
      ? {
          anyNvidiaGpu: inferred.anyNvidiaGpu,
          gpuModelSlug: inferred.gpuModelSlug,
          cpuUnits: inferred.cpuUnits,
          memoryGi: inferred.memoryGi,
          storageGi: inferred.storageGi,
          uactPerBlockOverride: inferred.uactPerBlockOverride,
        }
      : null,
    onChainGpuAttributes: gpuAttrs,
    lease,
    canRetryManifest: !leaseManifestRetryBlockedReason(lease),
    retryBlockedReason: leaseManifestRetryBlockedReason(lease),
    provider,
    hostUri,
    manifestUploadPath: hostUri ? `${hostUri}/deployment/${dseq}/manifest` : null,
    hints,
    bidAlignment: bidAlignment
      ? {
          aligned: bidAlignment.aligned,
          issues: bidAlignment.issues,
          deployment: bidAlignment.deployment,
          bid: bidAlignment.bid,
        }
      : null,
  });
}
